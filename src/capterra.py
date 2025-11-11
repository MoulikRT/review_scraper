import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse, urljoin
import scrapy
from typing import Any, Iterator, Optional, Union
from scrapy.http import Response, Request
from scrapy_playwright.page import PageMethod


class CapterraSpider(scrapy.Spider):
    name = 'capterra'
    start_urls: list[str]
    handle_httpstatus_list = [403, 429]
    # Use Playwright to render JS and pass Cloudflare checks in a compliant way
    # Build optional proxy config from environment variables (recommended: residential proxy)
    _proxy_server = os.environ.get("PLAYWRIGHT_PROXY_SERVER")  # e.g. http://host:port or socks5://host:port
    _proxy_username = os.environ.get("PLAYWRIGHT_PROXY_USERNAME")
    _proxy_password = os.environ.get("PLAYWRIGHT_PROXY_PASSWORD")

    custom_settings = {
        # Set a realistic UA and headers
        "USER_AGENT": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "DEFAULT_REQUEST_HEADERS": {
            "Accept-Language": "en-US,en;q=0.9",
            "Upgrade-Insecure-Requests": "1",
        },
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        "TWISTED_REACTOR": "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
        "PLAYWRIGHT_BROWSER_TYPE": "chromium",
        "PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT": 45000,
        "PLAYWRIGHT_LAUNCH_OPTIONS": {
            "headless": True,
            # Optional: Slow down a bit
            # "slow_mo": 50,
            # Optional proxy (filled below if env set)
        },
        "PLAYWRIGHT_CONTEXTS": {
            "default": {
                "viewport": {"width": 1366, "height": 768},
                "locale": "en-US",
                "java_script_enabled": True,
                "timezone_id": "America/New_York",
                # Mirror Scrapy UA
                "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "extra_http_headers": {
                    "Accept-Language": "en-US,en;q=0.9",
                },
                # Let Playwright set a realistic UA for Chromium; override if needed
            }
        },
        # Be polite and reduce load; tweak as needed
        "CONCURRENT_REQUESTS": 8,
        "DOWNLOAD_TIMEOUT": 60,
    }

    def __init__(self, product_url: Optional[str] = None, *args: Any, **kwargs: Any) -> None:
        super(CapterraSpider, self).__init__(*args, **kwargs)
        if product_url:
            self.start_urls = [product_url]
        else:
            # Default to Fiverr (India) product page example
            self.start_urls = ['https://www.capterra.in/software/1021673/fiverr-workspace']

    def start_requests(self) -> Iterator[Request]:
        # Inject stealthy init script to reduce automation fingerprints
        stealth_script = (
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
        # If proxy env is set, apply it at browser-launch level
        if self._proxy_server:
            proxy_cfg = {"server": self._proxy_server}
            if self._proxy_username and self._proxy_password:
                proxy_cfg.update({
                    "username": self._proxy_username,
                    "password": self._proxy_password,
                })
            # mutate launch options
            self.custom_settings["PLAYWRIGHT_LAUNCH_OPTIONS"]["proxy"] = proxy_cfg

        playwright_meta = {
            "playwright": True,
            "playwright_context": "default",
            "playwright_page_methods": [
                PageMethod("add_init_script", script=(
                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                )),
                PageMethod("wait_for_load_state", "domcontentloaded"),
                PageMethod("wait_for_load_state", "networkidle"),
                PageMethod("wait_for_timeout", 1500),
            ],
        }
        for url in self.start_urls:
            yield scrapy.Request(url, callback=self.parse, meta=playwright_meta)

    def parse(self, response: Response) -> Iterator[Union[Request, dict[str, Any]]]:
        # If there's a dedicated reviews page, follow it first to get full pagination
        reviews_page: Optional[str] = response.css('a[data-evdtl="button_read-all-reviews"]::attr(href)').get()
        if reviews_page:
            yield response.follow(
                reviews_page,
                callback=self.parse_reviews,
                meta={
                    "playwright": True,
                    "playwright_context": "default",
                    "playwright_page_methods": [
                        PageMethod("add_init_script", script=(
                            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                        )),
                        PageMethod("wait_for_load_state", "domcontentloaded"),
                        PageMethod("wait_for_load_state", "networkidle"),
                        PageMethod("wait_for_timeout", 1000),
                    ],
                    "pagination_seed": True,
                },
            )

        # Also parse any reviews present on the product page itself
        yield from self.parse_reviews(response)

    def parse_reviews(self, response: Response) -> Iterator[Union[Request, dict[str, Any]]]:
        # Handle Cloudflare blocks by retrying on .com domain as fallback
        if response.status in (403, 429):
            tried_fallback = bool(response.meta.get("tried_fallback"))
            fallback = self._fallback_reviews_host(response.url)
            if fallback and not tried_fallback:
                yield response.follow(
                    fallback,
                    callback=self.parse_reviews,
                    dont_filter=True,
                    meta={
                        "playwright": True,
                        "playwright_context": "default",
                        "playwright_page_methods": [
                            PageMethod("add_init_script", script=(
                                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                            )),
                            PageMethod("wait_for_load_state", "domcontentloaded"),
                            PageMethod("wait_for_load_state", "networkidle"),
                            PageMethod("wait_for_timeout", 1500),
                        ],
                        "tried_fallback": True,
                        # Keep seed flag if we were seeding pagination
                        "pagination_seed": response.meta.get("pagination_seed", False),
                    },
                )
                return
            # Give up on this branch if fallback already tried
            return

        review_cards = response.xpath('//div[contains(@class, "review-card")]')

        for card in review_cards:
            # Core right-column content
            title_raw: Optional[str] = card.xpath('.//h3[contains(@class, "h5") and contains(@class, "fw-bold")]/text()').get()
            rating_raw: Optional[str] = card.xpath('.//span[contains(@class, "star-rating-component")]//span[contains(@class, "ms-1")]/text()').get()
            relative_time_raw: Optional[str] = card.xpath('.//div[contains(@class, "text-ash") and contains(@class, "mb-3")]//span[contains(@class, "ms-2")]/text()').get()

            # Comments text sits within same <p> as the label
            comments_raw: Optional[str] = card.xpath(
                './/p[span[contains(@class, "fw-bold") and normalize-space(.)="Comments:"]]/span[last()]/text()'
            ).get()

            # Pros and Cons: next <p> after the bold label
            pros_raw: Optional[str] = card.xpath(
                'normalize-space((.//p[normalize-space(.)="Pros:"]/following-sibling::p[1])/text())'
            ).get()
            cons_raw: Optional[str] = card.xpath(
                'normalize-space((.//p[normalize-space(.)="Cons:"]/following-sibling::p[1])/text())'
            ).get()

            # Left-column author block
            reviewer_name_raw: Optional[str] = card.xpath(
                './/div[contains(@class, "col") and contains(@class, "ps-0")]//div[contains(@class, "h5") and contains(@class, "fw-bold")]/text()'
            ).get()
            reviewer_role_raw: Optional[str] = card.xpath(
                'normalize-space((.//div[contains(@class, "col") and contains(@class, "ps-0")]//following::div[contains(@class, "text-ash")][1])/text())'
            ).get()
            reviewer_pfp_raw: Optional[str] = card.xpath('.//img[contains(@class, "profile-picture")]/@src').get()
            verified_linkedin_user: bool = bool(card.xpath('.//svg[contains(@class, "icon-linkedin-square")]')) or bool(
                card.xpath('.//div[contains(normalize-space(.), "Verified LinkedIn User")]')
            )

            # Additional meta (best-effort)
            industry_raw: Optional[str] = card.xpath(
                'normalize-space((.//div[contains(@class, "col-12") and contains(@class, "pt-lg-3")]//div[contains(@class, "mb-2")][1])/text())'
            ).get()
            used_for_raw: Optional[str] = card.xpath(
                'normalize-space(.//div[contains(@class, "mb-2") and contains(normalize-space(.), "Used the Software for:")]/text())'
            ).get()

            # Cleaned fields
            reviewer_name = self._clean(reviewer_name_raw)
            reviewer_role = self._clean(reviewer_role_raw)
            reviewer_pfp = self._clean(reviewer_pfp_raw)
            industry = self._clean(industry_raw)
            used_for = self._clean(used_for_raw)
            rating = self._clean(rating_raw)
            title = self._clean(title_raw)
            comments = self._clean(comments_raw)
            pros = self._clean(pros_raw)
            cons = self._clean(cons_raw)
            relative_time = self._clean(relative_time_raw)

            yield {
                'reviewer_name': reviewer_name,
                'reviewer_role': reviewer_role,
                'reviewer_pfp': reviewer_pfp,
                'verified_linkedin_user': verified_linkedin_user,
                'industry': industry,
                'used_for': used_for,
                'rating': rating,
                'title': title,
                'comments': comments,
                'pros': pros,
                'cons': cons,
                'relative_time': relative_time,
                'source_url': response.url,
            }

        # Determine max pages from HTML and enqueue the rest if we're on the seed page
        current_page = self._get_current_page_number(response.url)
        is_seed = response.meta.get("pagination_seed", False) or current_page in (None, 1)
        if is_seed:
            max_page = self._extract_max_page_number(response)
            if max_page and (current_page or 1) < max_page:
                for page_num in range((current_page or 1) + 1, max_page + 1):
                    page_url = self._build_page_url(response.url, page_num)
                    yield response.follow(
                        page_url,
                        callback=self.parse_reviews,
                        meta={
                            "playwright": True,
                            "playwright_context": "default",
                            "playwright_page_methods": [
                                PageMethod("add_init_script", script=(
                                    "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                                )),
                                PageMethod("wait_for_load_state", "domcontentloaded"),
                                PageMethod("wait_for_load_state", "networkidle"),
                                PageMethod("wait_for_timeout", 1000),
                            ],
                        },
                    )

        # Fallback: Attempt to paginate if a next link exists on reviews listing pages
        next_page: Optional[str] = (
            response.css('a[rel="next"]::attr(href)').get()
            or response.css('a[aria-label*="Next"]::attr(href)').get()
        )
        if next_page:
            yield response.follow(
                next_page,
                callback=self.parse_reviews,
                meta={
                    "playwright": True,
                    "playwright_context": "default",
                    "playwright_page_methods": [
                        PageMethod("add_init_script", script=(
                            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                        )),
                        PageMethod("wait_for_load_state", "domcontentloaded"),
                        PageMethod("wait_for_load_state", "networkidle"),
                        PageMethod("wait_for_timeout", 1000),
                    ],
                },
            )

    def _extract_max_page_number(self, response: Response) -> Optional[int]:
        # 1) From pagination links like ?page=K
        hrefs = response.css('a[href*="?page="]::attr(href), a[href*="&page="]::attr(href)').getall()
        max_page: Optional[int] = None
        for href in hrefs:
            abs_url = urljoin(response.url, href)
            parsed = urlparse(abs_url)
            qs = parse_qs(parsed.query)
            page_vals = qs.get('page')
            if page_vals:
                for val in page_vals:
                    try:
                        num = int(val)
                        if max_page is None or num > max_page:
                            max_page = num
                    except ValueError:
                        continue
        if max_page is not None:
            return max_page
        # 2) Fallback: numeric pagination button texts
        texts = response.xpath('//a[normalize-space() and not(@aria-label)][contains(@class, "page") or contains(@class, "pagination")]//text()').getall()
        for t in texts:
            t = (t or '').strip()
            if t.isdigit():
                num = int(t)
                if max_page is None or num > max_page:
                    max_page = num
        return max_page

    def _get_current_page_number(self, url: str) -> Optional[int]:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        vals = qs.get('page')
        if not vals:
            return None
        try:
            return int(vals[0])
        except (ValueError, TypeError):
            return None

    def _build_page_url(self, base_url: str, page_number: int) -> str:
        parsed = urlparse(base_url)
        qs = parse_qs(parsed.query)
        qs['page'] = [str(page_number)]
        new_query = urlencode({k: v[0] if len(v) == 1 else v for k, v in qs.items()}, doseq=True)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))

    def _clean(self, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        # Collapse all whitespace (including newlines) to single spaces and strip
        return ' '.join(value.split())

    def _fallback_reviews_host(self, url: str) -> Optional[str]:
        # Switch between .in and .com for the /reviews/... path to evade locale-specific CF rules
        parsed = urlparse(url)
        if parsed.netloc.endswith('capterra.in'):
            return urlunparse((parsed.scheme, 'www.capterra.com', parsed.path, parsed.params, parsed.query, parsed.fragment))
        if parsed.netloc.endswith('capterra.com'):
            return urlunparse((parsed.scheme, 'www.capterra.in', parsed.path, parsed.params, parsed.query, parsed.fragment))
        return None


if __name__ == "__main__":
    # To run the spider, use:
    # scrapy runspider capterra.py -o capterra_reviews.json -a product_url="https://www.capterra.in/software/PRODUCT_ID/slug"
    pass


