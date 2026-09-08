import { test, expect } from "@playwright/test";

test("keeps pending AI dialogue through rerenders and effect resubscription", async ({ page }) => {
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const lines = ["The flame wakes and your trial begins.", "We stand together against your fire.", "Together we will close this rift."];
  await page.route("**/.netlify/functions/dialogue", async (route) => {
    calls++;
    await pending;
    await route.fulfill({ json: { source: "ai", lines } });
  });
  await page.goto("/e2e/fixtures/dialogue-hook.html");
  await expect.poll(() => calls).toBe(1);
  await page.getByRole("button", { name: "Rerender" }).click();
  await page.getByRole("button", { name: "Toggle dialogue" }).click();
  await page.getByRole("button", { name: "Toggle dialogue" }).click();
  release();
  await expect(page.locator("output")).toHaveText(JSON.stringify({ EMBERMAW: lines }));
  expect(calls).toBe(1);
});
