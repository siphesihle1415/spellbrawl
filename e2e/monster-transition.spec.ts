import { expect, test, type Page } from "@playwright/test";

async function starts(page: Page) {
  return page.evaluate(() => (window as typeof window & {
    animationStarts: { clip: string; root: string }[];
  }).animationStarts);
}

async function clearStarts(page: Page) {
  await page.evaluate(() => { (window as typeof window & { animationStarts: unknown[] }).animationStarts.length = 0; });
}

for (const mode of ["playground", "host", "guest"]) {
  test(`${mode}: changing rounds never restarts the outgoing monster`, async ({ page }) => {
    await page.goto(`/e2e/fixtures/monster-transition.html${mode === "guest" ? "?guest" : ""}`);
    await expect.poll(() => starts(page)).not.toHaveLength(0);
    const oldRoot = (await starts(page))[0].root;
    if (mode !== "playground") {
      await page.getByRole("button", { name: "Defeat monster", exact: true }).click();
      await expect.poll(async () => (await starts(page)).some((entry) => entry.clip.includes("falling_down"))).toBe(true);
      await page.getByRole("button", { name: "Finish death hold" }).click();
      await expect(page.locator("output")).toHaveText("EMBERMAW ROUND_COMPLETE");
    }
    await clearStarts(page);
    await page.getByRole("button", { name: mode === "playground" ? "Select third-level spell" : "Both continue" }).click();
    await expect.poll(async () => (await starts(page)).some((entry) => entry.root !== oldRoot)).toBe(true);
    expect((await starts(page)).filter((entry) => entry.root === oldRoot)).toEqual([]);
    await page.screenshot({ path: `test-results/monster-transition-${mode}.png` });
  });
}
