import scrapy

class TrustpilotSpider(scrapy.Spider):
    name = 'trustpilot'
    
    def __init__(self, company_url=None, *args, **kwargs):
        super(TrustpilotSpider, self).__init__(*args, **kwargs)
        if company_url:
            self.start_urls = [company_url]
        else:
            # Replace with the company URL you want to scrape
            self.start_urls = ['https://www.trustpilot.com/review/www.fiverr.com']

    def parse(self, response):
        # Find all review containers
        reviews = response.css('div[data-testid="service-review-card-v2"]')
        
        for review in reviews:
            # Extract star rating from the image src
            star_img_src = review.css('img.CDS_StarRating_starRating__614d2e::attr(src)').get()
            star_count = None
            if star_img_src:
                # Extract number from 'stars-X.svg'
                star_count = star_img_src.split('stars-')[-1].split('.')[0]
            
            # Get reviewer details
            reviewer_section = review.css('aside[aria-label*="Info for"]')
            
            yield {
                'reviewer_name': reviewer_section.css('span[data-consumer-name-typography="true"]::text').get(),
                'reviewer_pfp': reviewer_section.css('img[data-consumer-avatar-image="true"]::attr(src)').get(),
                'review_count': reviewer_section.css('span[data-consumer-reviews-count-typography="true"]::text').get(),
                'reviewer_country': reviewer_section.css('span[data-consumer-country-typography="true"]::text').get(),
                'star_rating': star_count,
                'title': review.css('h2[data-service-review-title-typography="true"]::text').get(),
                'content': review.css('p[data-service-review-text-typography="true"]::text').get(),
                'date_of_experience': review.css('p[data-service-review-date-of-experience-typography="true"] span::text').get()
            }
            
        # Follow pagination if available
        next_page = response.css('a[data-pagination-button-next="true"]::attr(href)').get()
        if next_page:
            yield response.follow(next_page, self.parse)


if __name__ == "__main__":
    # To run the spider, use:
    # scrapy runspider trustpilot.py -o reviews.json -a company_url="https://www.trustpilot.com/review/COMPANY_NAME"
    pass
