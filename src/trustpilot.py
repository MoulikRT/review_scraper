import os
import json
import time
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from typing import Any, Iterator, Optional, Union
import scrapy
from scrapy.http import Response, Request
from scrapy_playwright.page import PageMethod


class TrustpilotSpider(scrapy.Spider):
    name = 'trustpilot'
    start_urls: list[str]
    handle_httpstatus_list = [403, 429]
    
    # Resumability: checkpoint file to track progress
    checkpoint_file = 'trustpilot_checkpoint.json'
    scraped_review_ids: set[str] = set()
    last_page_scraped: int = 0
    
    # Rate limiting and retry tracking
    max_retries = 5
    retry_delays = {
        403: 300,  # IP block - wait 5 minutes
        429: 60,   # Rate limit - wait 1 minute
    }
    
    # Target number of reviews to collect
    target_reviews = 2000
    max_pages = 100  # Maximum pages to try (increased to get more reviews)
    
    custom_settings = {
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
        "PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT": 90000,  # Increased to 90 seconds
        "PLAYWRIGHT_LAUNCH_OPTIONS": {
            "headless": True,
        },
        "PLAYWRIGHT_CONTEXTS": {
            "default": {
                "viewport": {"width": 1366, "height": 768},
                "locale": "en-US",
                "java_script_enabled": True,
                "timezone_id": "America/New_York",
                "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "extra_http_headers": {
                    "Accept-Language": "en-US,en;q=0.9",
                },
                "accept_downloads": True,
                "ignore_https_errors": False,
            }
        },
        "CONCURRENT_REQUESTS": 2,  # Reduced to be more respectful
        "DOWNLOAD_TIMEOUT": 60,
        "DOWNLOAD_DELAY": 3,  # Increased delay between requests
        "RANDOMIZE_DOWNLOAD_DELAY": 0.5,  # Randomize delay by 50%
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 3,
        "AUTOTHROTTLE_MAX_DELAY": 10,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 1.5,
        "AUTOTHROTTLE_DEBUG": False,
        "RETRY_ENABLED": True,
        "RETRY_TIMES": 3,
        "RETRY_HTTP_CODES": [403, 429, 500, 502, 503, 504],
    }

    def __init__(self, company_url: Optional[str] = None, *args: Any, **kwargs: Any) -> None:
        super(TrustpilotSpider, self).__init__(*args, **kwargs)
        if company_url:
            self.start_urls = [company_url]
        else:
            # Default to Fiverr
            self.start_urls = ['https://www.trustpilot.com/review/www.fiverr.com']
        
        # Load checkpoint if exists
        self._load_checkpoint()
        
        # Load cookies if available (for authenticated session)
        self.cookies_file = 'trustpilot_cookies.json'
        self._load_cookies()
        
        # Update PLAYWRIGHT_CONTEXTS with storage_state if cookies are available
        if hasattr(self, 'storage_state_file') and self.storage_state_file and os.path.exists(self.storage_state_file):
            try:
                # Update the context config to include storage_state
                self.custom_settings["PLAYWRIGHT_CONTEXTS"]["default"]["storage_state"] = self.storage_state_file
                self.logger.info("Updated Playwright context with storage_state for authentication")
            except Exception as e:
                self.logger.warning(f"Failed to update context with storage_state: {e}")

    def _load_checkpoint(self) -> None:
        """Load progress from checkpoint file"""
        if os.path.exists(self.checkpoint_file):
            try:
                with open(self.checkpoint_file, 'r') as f:
                    checkpoint = json.load(f)
                    self.scraped_review_ids = set(checkpoint.get('scraped_review_ids', []))
                    self.last_page_scraped = checkpoint.get('last_page_scraped', 0)
                    self.logger.info(f"Loaded checkpoint: {len(self.scraped_review_ids)} reviews scraped, last page: {self.last_page_scraped}")
            except Exception as e:
                self.logger.warning(f"Failed to load checkpoint: {e}")

    def _save_checkpoint(self) -> None:
        """Save progress to checkpoint file"""
        try:
            checkpoint = {
                'scraped_review_ids': list(self.scraped_review_ids),
                'last_page_scraped': self.last_page_scraped,
            }
            with open(self.checkpoint_file, 'w') as f:
                json.dump(checkpoint, f, indent=2)
        except Exception as e:
            self.logger.warning(f"Failed to save checkpoint: {e}")
    
    def _load_cookies(self) -> None:
        """Load cookies from file if available and create storage_state file"""
        storage_state_file = 'trustpilot_storage_state.json'
        if os.path.exists(self.cookies_file):
            try:
                with open(self.cookies_file, 'r') as f:
                    cookies = json.load(f)
                    # Create storage_state for Playwright context
                    storage_state = {
                        'cookies': cookies,
                        'origins': [{
                            'origin': 'https://www.trustpilot.com',
                            'localStorage': []
                        }]
                    }
                    # Write storage_state file for scrapy-playwright to use
                    with open(storage_state_file, 'w') as sf:
                        json.dump(storage_state, sf, indent=2)
                    self.storage_state_file = storage_state_file
                    self.logger.info(f"Loaded {len(cookies)} cookies from {self.cookies_file}")
            except Exception as e:
                self.logger.warning(f"Failed to load cookies: {e}")
                self.storage_state_file = None
        else:
            self.storage_state_file = None
            self.logger.info("No cookies file found. Running without authentication.")

    def _get_review_id(self, review_data: dict[str, Any]) -> str:
        """Generate a unique ID for a review based on reviewer and date"""
        reviewer = review_data.get('reviewer_name', 'unknown')
        date = review_data.get('date', 'unknown')
        return f"{reviewer}_{date}"

    def start_requests(self) -> Iterator[Request]:
        """Start requests with Playwright"""
        # Update context with storage_state if cookies are available
        if hasattr(self, 'storage_state_file') and self.storage_state_file and os.path.exists(self.storage_state_file):
            # Update the default context with storage_state file path
            # Note: This modifies settings after init, which may not work with scrapy-playwright
            # Alternative: Use page.add_init_script to set cookies
            self.logger.info(f"Using authenticated session with storage_state from {self.storage_state_file}")
        
        # Prepare page methods
        page_methods = [
            PageMethod("add_init_script", script=(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )),
        ]
        
        # Note: Cookies will be loaded via storage_state file if it exists
        # scrapy-playwright should automatically use storage_state from the context config
        # We update the context config to include storage_state if available
        if hasattr(self, 'storage_state_file') and self.storage_state_file and os.path.exists(self.storage_state_file):
            # Try to update context config (may not work if context already created)
            try:
                # This is a workaround - ideally scrapy-playwright would support this
                # For now, we'll rely on the storage_state file being loaded by Playwright
                pass
            except Exception as e:
                self.logger.warning(f"Failed to configure storage_state: {e}")
        
        page_methods.extend([
            # Accept cookies if cookie banner appears (using standard CSS selectors)
            PageMethod("evaluate", 
                "() => { "
                "const buttons = document.querySelectorAll('button'); "
                "for (const btn of buttons) { "
                "  const text = btn.textContent || btn.innerText || ''; "
                "  const ariaLabel = btn.getAttribute('aria-label') || ''; "
                "  if (text.includes('Got it') || text.includes('Accept') || ariaLabel.includes('Got it')) { "
                "    btn.click(); "
                "    break; "
                "  } "
                "} "
                "}"
            ),
            PageMethod("wait_for_load_state", "domcontentloaded"),
            PageMethod("wait_for_load_state", "networkidle"),
            PageMethod("wait_for_timeout", 3000),  # Increased wait time
        ])
        
        playwright_meta = {
            "playwright": True,
            "playwright_context": "default",
            "playwright_page_methods": page_methods,
        }
        for url in self.start_urls:
            yield scrapy.Request(url, callback=self.parse, meta=playwright_meta)

    def parse(self, response: Response) -> Iterator[Union[Request, dict[str, Any]]]:
        """Parse reviews from the page"""
        # Handle rate limiting and IP blocks with exponential backoff
        if response.status == 429:
            retry_count = response.meta.get('retry_count', 0)
            if retry_count < self.max_retries:
                wait_time = self.retry_delays[429] * (2 ** retry_count)  # Exponential backoff
                self.logger.warning(
                    f"Rate limited (429) on {response.url}. "
                    f"Retry {retry_count + 1}/{self.max_retries}. Waiting {wait_time}s..."
                )
                time.sleep(wait_time)
                retry_request = response.request.replace(dont_filter=True)
                retry_request.meta['retry_count'] = retry_count + 1
                yield retry_request
            else:
                self.logger.error(f"Max retries reached for rate limit on {response.url}. Skipping.")
            return
        
        if response.status == 403:
            retry_count = response.meta.get('retry_count', 0)
            if retry_count < self.max_retries:
                wait_time = self.retry_delays[403] * (2 ** retry_count)  # Exponential backoff
                self.logger.warning(
                    f"IP blocked (403) on {response.url}. "
                    f"Retry {retry_count + 1}/{self.max_retries}. Waiting {wait_time}s..."
                )
                time.sleep(wait_time)
                retry_request = response.request.replace(dont_filter=True)
                retry_request.meta['retry_count'] = retry_count + 1
                yield retry_request
            else:
                self.logger.error(f"Max retries reached for IP block on {response.url}. Skipping.")
            return
        
        # Check if we were redirected to login page (indicates blocking)
        if '/users/connect' in response.url or 'login' in response.url.lower():
            self.logger.warning(
                f"Redirected to login page on {response.url}. "
                f"Trustpilot may be blocking automated access after page {self.last_page_scraped}. "
                f"Collected {len(self.scraped_review_ids)} reviews so far."
            )
            return
        
        # Check for other error statuses
        if response.status >= 400:
            self.logger.warning(f"Got HTTP {response.status} for {response.url}")
            retry_count = response.meta.get('retry_count', 0)
            if retry_count < 2:  # Only retry twice for other errors
                wait_time = 10 * (retry_count + 1)
                self.logger.info(f"Retrying {response.url} after {wait_time}s...")
                time.sleep(wait_time)
                retry_request = response.request.replace(dont_filter=True)
                retry_request.meta['retry_count'] = retry_count + 1
                yield retry_request
            return

        # Extract current page number
        current_page = self._get_current_page_number(response.url)
        if current_page:
            self.last_page_scraped = max(self.last_page_scraped, current_page)

        # Find all review articles
        reviews = response.css('article[data-service-review-card-paper="true"]')
        
        if not reviews:
            # Fallback: try alternative selector
            reviews = response.css('article.styles_reviewCard__meSdm')
        
        self.logger.info(f"Found {len(reviews)} reviews on page {current_page or 1}")
        
        # Check if we've reached our target
        total_scraped = len(self.scraped_review_ids)
        if total_scraped >= self.target_reviews:
            self.logger.info(f"Reached target of {self.target_reviews} reviews. Stopping pagination.")
            return
        
        # If no reviews found, log it but continue (might be a temporary issue)
        if len(reviews) == 0:
            self.logger.warning(f"No reviews found on page {current_page or 1}. This might indicate the end of reviews or a temporary issue.")

        for review in reviews:
            # Extract reviewer information
            reviewer_section = review.css('aside[aria-label*="Info for"]')
            
            # Get reviewer name from the span with data-consumer-name-typography
            reviewer_name = self._clean(reviewer_section.css('span[data-consumer-name-typography="true"]::text').get())
            if not reviewer_name:
                # Fallback: get from link text
                reviewer_name = self._clean(reviewer_section.css('a::text').get())
            
            # Get reviewer link
            reviewer_link = reviewer_section.css('a[data-consumer-profile-link="true"]::attr(href)').get()
            if not reviewer_link:
                reviewer_link = reviewer_section.css('a::attr(href)').get()
            reviewer_link = urlunparse(('https', 'www.trustpilot.com', reviewer_link or '', '', '', '')) if reviewer_link else None
            
            # Extract date from time element
            date = self._clean(reviewer_section.css('time::text').get())
            
            # Extract avatar (could be initials or image)
            avatar_img = reviewer_section.css('img::attr(src)').get()
            avatar_initials = self._clean(reviewer_section.css('div[class*="Avatar"] span::text').get())
            
            # Extract star rating from image alt text
            star_img = review.css('img[alt*="Rated"]::attr(alt)').get()
            star_rating: Optional[str] = None
            if star_img:
                import re
                match = re.search(r'(\d+)\s+out\s+of\s+5', star_img)
                if match:
                    star_rating = match.group(1)
            
            # Extract review text - get all text from paragraph
            review_text = self._clean(' '.join(review.css('p::text').getall()))
            
            # Extract useful count
            useful_button = review.css('button[aria-label*="Useful"]')
            useful_text = self._clean(useful_button.css('::text').get() or '')
            useful_count = '0'
            if useful_text:
                import re
                match = re.search(r'(\d+)', useful_text)
                if match:
                    useful_count = match.group(1)
            
            # Build review data
            review_data = {
                'reviewer_name': reviewer_name,
                'reviewer_link': reviewer_link,
                'reviewer_avatar': avatar_img,
                'reviewer_initials': avatar_initials,
                'date': date,
                'star_rating': star_rating,
                'review_text': review_text,
                'useful_count': useful_count,
                'source_url': response.url,
                'page_number': current_page or 1,
            }
            
            # Check if we've already scraped this review
            review_id = self._get_review_id(review_data)
            if review_id not in self.scraped_review_ids:
                self.scraped_review_ids.add(review_id)
                yield review_data
            else:
                self.logger.debug(f"Skipping duplicate review: {review_id}")

        # Save checkpoint after processing page
        self._save_checkpoint()

        # Handle pagination
        current_page = self._get_current_page_number(response.url) or 1
        next_page_num = current_page + 1
        
        # Method 1: Check for next page button
        next_page_url = response.css('a[data-pagination-button-next="true"]::attr(href)').get()
        
        # Method 2: Check for page links in pagination
        if not next_page_url:
            # Try to find next page link
            page_links = response.css('a[href*="page="]::attr(href)').getall()
            for link in page_links:
                parsed = urlparse(link)
                qs = parse_qs(parsed.query)
                page_vals = qs.get('page')
                if page_vals and int(page_vals[0]) == next_page_num:
                    next_page_url = urlunparse(('https', 'www.trustpilot.com', parsed.path, parsed.params, parsed.query, parsed.fragment))
                    break
        
        # Method 3: Build next page URL manually
        # Always try to build next page URL if we haven't exceeded max pages
        # This ensures we continue even if a page has 0 reviews
        if not next_page_url:
            if next_page_num <= self.max_pages:
                next_page_url = self._build_page_url(response.url, next_page_num)
                self.logger.info(f"Building next page URL manually: page {next_page_num}")
        
        # Continue pagination if:
        # 1. We have a next page URL
        # 2. We haven't reached our target number of reviews
        # 3. We haven't exceeded max pages
        total_scraped = len(self.scraped_review_ids)
        if next_page_url and total_scraped < self.target_reviews and next_page_num <= self.max_pages:
            self.logger.info(f"Following pagination to page {next_page_num} (collected {total_scraped}/{self.target_reviews} reviews)")
            
            yield response.follow(
                next_page_url,
                callback=self.parse,
                meta={
                    "playwright": True,
                    "playwright_context": "default",
                    "playwright_page_methods": [
                        PageMethod("add_init_script", script=(
                            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                        )),
                        # Accept cookies if cookie banner appears
                        PageMethod("evaluate",
                            "() => { "
                            "const buttons = document.querySelectorAll('button'); "
                            "for (const btn of buttons) { "
                            "  const text = btn.textContent || btn.innerText || ''; "
                            "  const ariaLabel = btn.getAttribute('aria-label') || ''; "
                            "  if (text.includes('Got it') || text.includes('Accept') || ariaLabel.includes('Got it')) { "
                            "    btn.click(); "
                            "    break; "
                            "  } "
                            "} "
                            "}"
                        ),
                        PageMethod("wait_for_load_state", "domcontentloaded"),
                        PageMethod("wait_for_load_state", "networkidle"),
                        PageMethod("wait_for_timeout", 3000),  # Increased wait time
                    ],
                },
            )
        elif total_scraped >= self.target_reviews:
            self.logger.info(f"Target reached: {total_scraped} reviews collected. Stopping.")
        elif next_page_num > self.max_pages:
            self.logger.info(f"Max pages ({self.max_pages}) reached. Stopping.")
        elif not next_page_url:
            self.logger.info(f"No more pages found. Collected {total_scraped} reviews.")

    def _get_current_page_number(self, url: str) -> Optional[int]:
        """Extract current page number from URL"""
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        page_vals = qs.get('page')
        if page_vals:
            try:
                return int(page_vals[0])
            except (ValueError, TypeError):
                pass
        return None

    def _build_page_url(self, base_url: str, page_number: int) -> str:
        """Build URL for a specific page number"""
        parsed = urlparse(base_url)
        qs = parse_qs(parsed.query)
        qs['page'] = [str(page_number)]
        new_query = urlencode({k: v[0] if len(v) == 1 else v for k, v in qs.items()}, doseq=True)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))

    def _clean(self, value: Optional[str]) -> Optional[str]:
        """Clean and normalize text"""
        if value is None:
            return None
        # Collapse whitespace and strip
        return ' '.join(value.split()).strip()


if __name__ == "__main__":
    # To run the spider, use:
    # scrapy runspider trustpilot.py -o reviews.json -a company_url="https://www.trustpilot.com/review/COMPANY_NAME"
    pass
