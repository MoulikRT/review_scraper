import scrapy
from typing import Any, Iterator, Optional, Union
from scrapy.http import Response, Request


class CapterraSpider(scrapy.Spider):
    name = 'capterra'
    start_urls: list[str]

    def __init__(self, product_url: Optional[str] = None, *args: Any, **kwargs: Any) -> None:
        super(CapterraSpider, self).__init__(*args, **kwargs)
        if product_url:
            self.start_urls = [product_url]
        else:
            # Default to Fiverr (India) product page example
            self.start_urls = ['https://www.capterra.in/software/1021673/fiverr-workspace']

    def parse(self, response: Response) -> Iterator[Union[Request, dict[str, Any]]]:
        # If there's a dedicated reviews page, follow it first to get full pagination
        reviews_page: Optional[str] = response.css('a[data-evdtl="button_read-all-reviews"]::attr(href)').get()
        if reviews_page:
            yield response.follow(reviews_page, callback=self.parse_reviews)

        # Also parse any reviews present on the product page itself
        yield from self.parse_reviews(response)

    def parse_reviews(self, response: Response) -> Iterator[Union[Request, dict[str, Any]]]:
        review_cards = response.xpath('//div[contains(@class, "review-card")]')

        for card in review_cards:
            # Core right-column content
            title: Optional[str] = card.xpath('.//h3[contains(@class, "h5") and contains(@class, "fw-bold")]/text()').get()
            rating: Optional[str] = card.xpath('.//span[contains(@class, "star-rating-component")]//span[contains(@class, "ms-1")]/text()').get()
            relative_time: Optional[str] = card.xpath('.//div[contains(@class, "text-ash") and contains(@class, "mb-3")]//span[contains(@class, "ms-2")]/text()').get()

            # Comments text sits within same <p> as the label
            comments: Optional[str] = card.xpath(
                './/p[span[contains(@class, "fw-bold") and normalize-space(.)="Comments:"]]/span[last()]/text()'
            ).get()

            # Pros and Cons: next <p> after the bold label
            pros: Optional[str] = card.xpath(
                'normalize-space((.//p[normalize-space(.)="Pros:"]/following-sibling::p[1])/text())'
            ).get()
            cons: Optional[str] = card.xpath(
                'normalize-space((.//p[normalize-space(.)="Cons:"]/following-sibling::p[1])/text())'
            ).get()

            # Left-column author block
            reviewer_name: Optional[str] = card.xpath(
                './/div[contains(@class, "col") and contains(@class, "ps-0")]//div[contains(@class, "h5") and contains(@class, "fw-bold")]/text()'
            ).get()
            reviewer_role: Optional[str] = card.xpath(
                'normalize-space((.//div[contains(@class, "col") and contains(@class, "ps-0")]//following::div[contains(@class, "text-ash")][1])/text())'
            ).get()
            reviewer_pfp: Optional[str] = card.xpath('.//img[contains(@class, "profile-picture")]/@src').get()
            verified_linkedin_user: bool = bool(card.xpath('.//svg[contains(@class, "icon-linkedin-square")]')) or bool(
                card.xpath('.//div[contains(normalize-space(.), "Verified LinkedIn User")]')
            )

            # Additional meta (best-effort)
            industry: Optional[str] = card.xpath(
                'normalize-space((.//div[contains(@class, "col-12") and contains(@class, "pt-lg-3")]//div[contains(@class, "mb-2")][1])/text())'
            ).get()
            used_for: Optional[str] = card.xpath(
                'normalize-space(.//div[contains(@class, "mb-2") and contains(normalize-space(.), "Used the Software for:")]/text())'
            ).get()

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

        # Attempt to paginate if a next link exists on reviews listing pages
        next_page: Optional[str] = (
            response.css('a[rel="next"]::attr(href)').get()
            or response.css('a[aria-label*="Next"]::attr(href)').get()
        )
        if next_page:
            yield response.follow(next_page, callback=self.parse_reviews)


if __name__ == "__main__":
    # To run the spider, use:
    # scrapy runspider capterra.py -o capterra_reviews.json -a product_url="https://www.capterra.in/software/PRODUCT_ID/slug"
    pass


