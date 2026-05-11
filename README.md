# Review Scraper

Tools for collecting and exploring public reviews of freelancing and software marketplaces (for example Trustpilot and Capterra). The Python side uses [Scrapy](https://scrapy.org/) with [scrapy-playwright](https://github.com/scrapy-plugins/scrapy-playwright) for JavaScript-heavy pages. A small [React](https://react.dev/) + [Vite](https://vite.dev/) app in `app/` loads exported JSON to browse reviews, charts, and search.

**Python package name:** `review-scraper` (see `pyproject.toml`).

## Requirements

- **Python** 3.13 or newer
- **[uv](https://docs.astral.sh/uv/)** (recommended) or another environment manager that respects `pyproject.toml` / `uv.lock`
- **Node.js** 18+ (for the dashboard in `app/`)
- **Playwright browsers** (Chromium) after installing dependencies

## Python setup

From the repository root:

```bash
uv sync
uv run playwright install chromium
```

Install Playwright’s system dependencies on Linux if prompted (`playwright install-deps`).

## Scrapers

Spiders live under `src/`. Run them with Scrapy’s `runspider` from the repo root so imports and paths match the comments in each file.

### Trustpilot (`src/trustpilot.py`)

Collects reviews from a Trustpilot company URL. The spider supports checkpoints, throttling, and Playwright rendering. You may need a logged-in session for deeper pagination; use the helper script to capture storage state from a real browser session:

```bash
uv run python src/extract_trustpilot_auth.py
```

Run the spider (example output file and company URL):

```bash
uv run scrapy runspider src/trustpilot.py -o trustpilot_reviews.json \
  -a company_url="https://www.trustpilot.com/review/www.example.com"
```

Sensitive artifacts such as cookies and checkpoint files are listed in `.gitignore`; do not commit credentials.

### Capterra (`src/capterra.py`)

Targets a Capterra product reviews URL. Optional proxy settings (useful for residential proxies) via environment variables:

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_PROXY_SERVER` | Proxy URL, e.g. `http://host:port` or `socks5://host:port` |
| `PLAYWRIGHT_PROXY_USERNAME` | Proxy username (if required) |
| `PLAYWRIGHT_PROXY_PASSWORD` | Proxy password (if required) |

Example:

```bash
uv run scrapy runspider src/capterra.py -o capterra_reviews.json \
  -a product_url="https://www.capterra.in/software/1021673/example-product"
```

### Repairing concatenated JSON

If a scrape produced malformed merged arrays, `fix_json.py` is a small utility to clean `trustpilot_reviews.json`-style output (run from the directory that contains the file, or adjust paths inside the script).

## Dashboard (`app/`)

The Vite app expects review data at `GET /trustpilot_reviews.json`. For local development, place (or symlink) your export as:

`app/public/trustpilot_reviews.json`

Then:

```bash
cd app
npm install
npm run dev
```

Use `npm run build` for a production build. The UI includes tabs for raw reviews and a dashboard (charts and filters depend on the shape of your JSON export).

## Roadmap

Ideas tracked for this project:

- Additional sources (e.g. G2, Reddit, Quora) where terms allow
- Stronger fault tolerance, persistence, and proxy rotation for long runs
- Server-friendly deployment
- Interactive dashboard enhancements: maps by country, rating over time, AI summaries, sentiment, word frequency, topic clustering, anomaly detection, review-quality scoring

## Legal and ethical use

Only scrape sites you are allowed to access, respect `robots.txt` and each site’s terms of service, avoid overloading servers (this repo already uses delays and low concurrency in places), and handle personal data responsibly. This software is for research and transparency work, not for circumventing access controls or harassing platforms or users.

## License

This repository does not currently include a `LICENSE` file. Clarify terms with the maintainers before reuse or distribution.
