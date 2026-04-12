import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        try:
            print("Navigating to http://localhost:8081/relatorios/apresentacao-gerencial")
            await page.goto('http://localhost:8081/relatorios/apresentacao-gerencial', timeout=60000)

            # Wait for some content to be sure we are on the right page
            await page.wait_for_load_state('networkidle')
            print(f"Page title: {await page.title()}")

            # Print page content briefly for debug
            body_text = await page.inner_text('body')
            print(f"Body text contains 'Apresentação Gerencial': {'Apresentação Gerencial' in body_text}")

            # Try to find the button
            button = page.get_by_role("button", name="Nova Apresentação")
            if await button.is_visible():
                print("Button 'Nova Apresentação' is visible")
                await button.click()
            else:
                print("Button 'Nova Apresentação' is NOT visible, looking for any button")
                buttons = await page.get_by_role("button").all_inner_texts()
                print(f"Buttons found: {buttons}")
                # Fallback click
                await page.click('button:has-text("Nova Apresentação")')

            # Wait for dialog
            await page.wait_for_selector('text=Gerar Nova Apresentação', timeout=10000)
            print("Dialog opened")

            # Click the Template select trigger
            # It's a button with "Selecione um template"
            await page.click('button:has-text("Selecione um template")')
            print("Template dropdown clicked")

            await asyncio.sleep(2)
            await page.screenshot(path='/home/jules/verification/dropdown_open_v3.png')

            # Check if templates are there
            standard = await page.is_visible('text=Padrão AviZee')
            dark = await page.is_visible('text=Executivo Dark')

            print(f"Standard Template visible: {standard}")
            print(f"Dark Template visible: {dark}")

        except Exception as e:
            print(f"Error during verification: {e}")
            await page.screenshot(path='/home/jules/verification/error_screenshot.png')
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
