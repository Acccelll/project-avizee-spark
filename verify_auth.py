import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        try:
            print("Navigating to login page...")
            await page.goto('http://localhost:8081/login')

            print("Filling login form...")
            await page.fill('input[type="email"]', 'admin@avizee.com')
            await page.fill('input[type="password"]', 'admin123456')
            await page.click('button:has-text("Entrar")')

            print("Waiting for navigation to dashboard...")
            await page.wait_for_url('http://localhost:8081/', timeout=10000)

            print("Navigating to Presentation page...")
            await page.goto('http://localhost:8081/relatorios/apresentacao-gerencial')
            await page.wait_for_load_state('networkidle')

            print(f"Page title: {await page.title()}")
            await page.screenshot(path='/home/jules/verification/presentation_page.png')

            # Open the dialog
            print("Opening generation dialog...")
            await page.click('button:has-text("Nova Apresentação")')
            await page.wait_for_selector('text=Gerar Nova Apresentação', timeout=10000)

            await page.screenshot(path='/home/jules/verification/dialog_auth.png')

            # Click Template select
            await page.click('button:has-text("Selecione um template")')
            await asyncio.sleep(1)
            await page.screenshot(path='/home/jules/verification/templates_auth.png')

        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path='/home/jules/verification/auth_error.png')
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
