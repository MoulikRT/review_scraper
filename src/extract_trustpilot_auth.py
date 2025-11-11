#!/usr/bin/env python3
"""
Extract Trustpilot authentication from your browser session
Run this AFTER you've manually signed up and logged into Trustpilot
"""

import json
import time
from playwright.sync_api import sync_playwright


def extract_auth_from_browser():
    """
    Opens browser, lets you log in to Trustpilot, then extracts auth
    """
    print("\n" + "="*60)
    print("Trustpilot Authentication Extractor")
    print("="*60)
    print("\nInstructions:")
    print("1. A browser window will open")
    print("2. Sign up/Log in to Trustpilot with your account")
    print("3. After logging in, return here and press Enter")
    print("4. The script will extract and save your authentication")
    print("\n" + "="*60 + "\n")
    
    input("Press Enter to open browser...")
    
    with sync_playwright() as p:
        # Launch browser in non-headless mode so you can interact
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport={'width': 1366, 'height': 768},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        )
        page = context.new_page()
        
        try:
            # Navigate to Trustpilot signup
            print("Opening Trustpilot signup page...")
            page.goto('https://www.trustpilot.com/users/connect?signup=True', timeout=60000)
            
            print("\n" + "="*60)
            print("Please sign up or log in to Trustpilot in the browser window")
            print("="*60)
            print("\nTips:")
            print("- Use your real email (Gmail, Outlook, etc.)")
            print("- Complete email verification if needed")
            print("- Make sure you're fully logged in")
            print("- Try accessing https://www.trustpilot.com/review/www.fiverr.com?page=11")
            print("  to confirm you can see pages beyond 10")
            print("\n" + "="*60 + "\n")
            
            input("Press Enter AFTER you're logged in and have verified it works...")
            
            # Give a moment for any final page loads
            time.sleep(2)
            
            # Test if authentication works
            print("\nTesting authentication...")
            page.goto('https://www.trustpilot.com/review/www.fiverr.com?page=11', timeout=60000)
            time.sleep(3)
            
            current_url = page.url
            if 'users/connect' in current_url or 'login' in current_url.lower():
                print("⚠ Warning: Still redirected to login page!")
                print("Authentication might not be working properly.")
                print("Make sure you're fully logged in before continuing.")
                
                response = input("\nContinue anyway? (y/n): ")
                if response.lower() != 'y':
                    print("Aborting...")
                    browser.close()
                    return False
            else:
                print("✓ Authentication verified! Can access page 11+")
            
            # Extract cookies
            print("\nExtracting authentication cookies...")
            cookies = context.cookies()
            print(f"✓ Extracted {len(cookies)} cookies")
            
            # Save cookies
            with open('trustpilot_cookies.json', 'w') as f:
                json.dump(cookies, f, indent=2)
            print("✓ Cookies saved to trustpilot_cookies.json")
            
            # Save full storage state (includes cookies + localStorage)
            storage_state = context.storage_state()
            with open('trustpilot_storage_state.json', 'w') as f:
                json.dump(storage_state, f, indent=2)
            print("✓ Storage state saved to trustpilot_storage_state.json")
            
            # Also save in the format the scraper expects
            storage_state_for_scraper = {
                'cookies': cookies,
                'origins': [{
                    'origin': 'https://www.trustpilot.com',
                    'localStorage': []
                }]
            }
            with open('trustpilot_storage_state.json', 'w') as f:
                json.dump(storage_state_for_scraper, f, indent=2)
            
            print("\n" + "="*60)
            print("✓ SUCCESS! Authentication extracted and saved")
            print("="*60)
            print("\nSaved files:")
            print("  - trustpilot_cookies.json")
            print("  - trustpilot_storage_state.json")
            print("\nYou can now run the scraper:")
            print("  uv run python -m scrapy runspider src/trustpilot.py -o trustpilot_reviews.json")
            print("\nThe scraper will automatically use your authentication!")
            print("="*60 + "\n")
            
            browser.close()
            return True
            
        except Exception as e:
            print(f"\n✗ Error: {e}")
            browser.close()
            return False


if __name__ == '__main__':
    success = extract_auth_from_browser()
    exit(0 if success else 1)

