import puppeteer, { type Browser, type Page } from "puppeteer";

let browser: Browser | null = null;

export async function launchBrowser(): Promise<Browser> {
  if (browser) return browser;

  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Open a new page, navigate to the server, and wait for Alpine.js to initialize.
 */
export async function openPage(baseUrl: string): Promise<Page> {
  const b = await launchBrowser();
  const page = await b.newPage();

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(baseUrl, { waitUntil: "networkidle2" });

  // Wait for Alpine.js to boot and fixtures to load
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[x-data]") as any;
      return el && el._x_dataStack && el._x_dataStack.length > 0;
    },
    { timeout: 10_000 },
  );

  // Small settle delay for Alpine reactivity
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

  return page;
}
