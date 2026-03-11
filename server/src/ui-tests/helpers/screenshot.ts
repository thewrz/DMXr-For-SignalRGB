import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, "..", "..", "..", "test-screenshots");
const BASELINES_DIR = join(SCREENSHOTS_DIR, "baselines");

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Capture a full-page screenshot and save it with a descriptive name.
 */
export async function captureScreenshot(
  page: Page,
  name: string,
): Promise<string> {
  await ensureDir(SCREENSHOTS_DIR);
  const filename = `${name}.png`;
  const filepath = join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  return filepath;
}

/**
 * Compare a screenshot against a baseline using pixelmatch.
 * If UPDATE_BASELINES=1 is set, saves current as the new baseline instead.
 * Returns diff information.
 */
export async function compareWithBaseline(
  page: Page,
  name: string,
  threshold = 0.1,
): Promise<{ match: boolean; diffPercentage: number; diffPath?: string }> {
  const { PNG } = await import("pngjs");
  const pixelmatch = (await import("pixelmatch")).default;

  await ensureDir(SCREENSHOTS_DIR);
  await ensureDir(BASELINES_DIR);

  // Puppeteer returns Uint8Array; pngjs needs Buffer for readUInt32BE
  const currentBuffer = Buffer.from(await page.screenshot({ fullPage: false }));
  const baselinePath = join(BASELINES_DIR, `${name}.png`);

  // Update mode: save current as baseline
  if (process.env["UPDATE_BASELINES"] === "1") {
    await writeFile(baselinePath, currentBuffer);
    return { match: true, diffPercentage: 0 };
  }

  // Load baseline
  let baselineBuffer: Buffer;
  try {
    baselineBuffer = await readFile(baselinePath);
  } catch {
    // No baseline yet — save current as baseline and pass
    await writeFile(baselinePath, currentBuffer);
    return { match: true, diffPercentage: 0 };
  }

  const current = PNG.sync.read(currentBuffer);
  const baseline = PNG.sync.read(baselineBuffer);

  // Size mismatch → automatic failure
  if (current.width !== baseline.width || current.height !== baseline.height) {
    const diffPath = join(SCREENSHOTS_DIR, `${name}-DIFF.png`);
    await writeFile(diffPath, currentBuffer);
    return {
      match: false,
      diffPercentage: 100,
      diffPath,
    };
  }

  const diff = new PNG({ width: current.width, height: current.height });
  const numDiffPixels = pixelmatch(
    current.data,
    baseline.data,
    diff.data,
    current.width,
    current.height,
    { threshold },
  );

  const totalPixels = current.width * current.height;
  const diffPercentage = (numDiffPixels / totalPixels) * 100;

  if (diffPercentage > 1) {
    const diffPath = join(SCREENSHOTS_DIR, `${name}-DIFF.png`);
    await writeFile(diffPath, PNG.sync.write(diff));
    return { match: false, diffPercentage, diffPath };
  }

  return { match: true, diffPercentage };
}
