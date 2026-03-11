import type { Page } from "puppeteer";

/**
 * Extract a subset of the Alpine.js reactive state from the page.
 * This reads from Alpine's internal data stack — use for state-desync testing only.
 */
export async function getAlpineState(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const el = document.querySelector("[x-data]") as any;
    if (!el || !el._x_dataStack) return {};

    const state = el._x_dataStack[0];
    // Deep-clone via JSON to unwrap Alpine's Proxy objects,
    // which otherwise serialize as plain objects with numeric keys
    return JSON.parse(JSON.stringify({
      fixtures: state.fixtures ?? [],
      groups: state.groups ?? [],
      selectedFixtureIds: state.selectedFixtureIds ?? [],
      serverOnline: state.serverOnline ?? false,
      sidebarOpen: state.sidebarOpen ?? true,
      showSettings: state.showSettings ?? false,
      gridError: state.gridError ?? "",
    }));
  });
}

/**
 * Wait until an Alpine state predicate is truthy.
 */
export async function waitForAlpineState(
  page: Page,
  predicate: string,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (pred: string) => {
      const el = document.querySelector("[x-data]") as any;
      if (!el || !el._x_dataStack) return false;
      const state = el._x_dataStack[0];
      return new Function("state", `with(state) { return ${pred}; }`)(state);
    },
    { timeout },
    predicate,
  );
}

/**
 * Get the fixture count from Alpine state.
 */
export async function getFixtureCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector("[x-data]") as any;
    // Array.from unwraps the Alpine Proxy so .length works correctly
    const fixtures = el?._x_dataStack?.[0]?.fixtures;
    return fixtures ? Array.from(fixtures).length : 0;
  });
}

/**
 * Get the selected fixture IDs from Alpine state.
 */
export async function getSelectedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const el = document.querySelector("[x-data]") as any;
    const ids = el?._x_dataStack?.[0]?.selectedFixtureIds;
    // Array.from + map unwraps Alpine Proxy for clean serialization
    return ids ? Array.from(ids).map((id: any) => String(id)) : [];
  });
}
