import { expect, test } from "@playwright/test";

test("touch devices show the rotation prompt only after startup assets load", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  let releaseAsset!: () => void;
  const assetGate = new Promise<void>((resolve) => { releaseAsset = resolve; });
  try {
    const page = await context.newPage();
    await page.route("**/models/spellbrawl-three-rooms-open-lighting.glb", async (route) => {
      await assetGate;
      await route.continue();
    });
    await page.goto("/");
    await expect(page.locator(".startup-loader")).toBeVisible();
    // Even after the loader's minimum display time, an outstanding asset must gate the prompt.
    await page.waitForTimeout(1100);
    const prompt = page.getByRole("dialog", { name: "Rotate your device to play" });
    await expect(prompt).toHaveCount(0);
    releaseAsset();
    await expect(page.locator(".startup-loader")).toHaveCount(0, { timeout: 120_000 });
    await expect(prompt).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(prompt).toBeVisible();
    expect(await page.locator(".rotate-prompt").evaluate((el) => el.matches(":modal"))).toBe(true);
    await page.screenshot({ path: "test-results/rotate-phone.png" });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(prompt).toHaveCount(0);
    await page.getByRole("button", { name: "Practice Spells" }).tap();
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(prompt).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(prompt).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Exit playground" })).toBeVisible();
  } finally { releaseAsset(); await context.close(); }
});

test("landscape touch spell panels leave room above cameras and have tappable controls", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 568, height: 320 } });
  try {
    const page = await context.newPage();
    await page.goto("/?lite=1");
    await page.getByRole("button", { name: "Practice Spells" }).tap();
    for (const size of [{ width: 568, height: 320 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      const picker = page.getByLabel("Choose a spell to test");
      const pickerBox = (await picker.boundingBox())!;
      const menuBox = (await page.locator(".move-menu").boundingBox())!;
      const cameraBox = (await page.locator(".playground-camera").boundingBox())!;
      expect(pickerBox.height).toBeGreaterThan(size.height - 16 - 230);
      expect(menuBox.height).toBeGreaterThan(size.height - 16 - 190);
      expect(pickerBox.y + pickerBox.height).toBeLessThan(cameraBox.y);
      for (const button of await picker.getByRole("button").all()) {
        await button.scrollIntoViewIfNeeded();
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await button.tap();
        await expect(button).toHaveClass("is-selected");
      }
      await page.getByRole("button", { name: "Open move help" }).tap();
      await expect(page.getByRole("dialog", { name: "Move help" })).toBeVisible();
      await page.getByRole("button", { name: "Close move help" }).tap();
      await page.screenshot({ path: `test-results/touch-panels-${size.width}.png` });
    }
  } finally { await context.close(); }
});
