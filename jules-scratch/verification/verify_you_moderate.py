from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to the apps page
    page.goto("http://127.0.0.1:8080/apps")

    # Find the card with the title "Modera tu" and then find the link within it
    card = page.locator("div.relative:has-text('Modera tu')")

    # Click the "Avvia App" link within the card
    card.get_by_role("link", name="Avvia App").click()

    # Take a screenshot of the app page
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
