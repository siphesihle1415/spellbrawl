import { expect, test } from "@playwright/test";
import { expectAudioFile, observeAudio } from "./audioProbe";

test("mobile playground spells are clickable and help retains keyboard focus", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?lite=1");
  await page.getByRole("button", { name: "Practice Spells" }).click();
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 844 });
    const picker = page.getByLabel("Choose a spell to test");
    for (const button of await picker.getByRole("button").all()) {
      await button.click({ timeout: 3_000 });
      await expect(button).toHaveClass("is-selected");
    }
    const opener = page.getByRole("button", { name: "Open move help" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Move help" });
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press("Tab");
      // Native dialogs may focus the document between cycles, but never a background control.
      expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest("dialog"))).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest("dialog"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    const camera = await page.locator(".playground-camera").boundingBox();
    const message = await page.locator(".combat-message").boundingBox();
    expect(message!.y + message!.height).toBeLessThanOrEqual(camera!.y);
    await page.screenshot({ path: `test-results/playground-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test("a full room rejects a third player and allows another room", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const host = await context.newPage();
    const guest = await context.newPage();
    const third = await context.newPage();
    await host.goto("/?lite=1");
    await host.getByRole("button", { name: "Create room" }).click();
    const code = await host.locator("h2").filter({ hasText: /^[A-Z2-9]{4}$/ }).textContent();
    for (const page of [guest, third]) {
      await page.goto("/?lite=1");
      await page.getByPlaceholder("CODE").fill(code!);
      await page.getByRole("button", { name: "Join", exact: true }).click();
    }
    await expect(third.getByText("Room full. Try another code or create a new room.")).toBeVisible({ timeout: 5_000 });
    await expect(host.getByRole("button", { name: "Waiting for cameras" })).toBeVisible();
    await third.getByRole("button", { name: "Create room" }).click();
    await expect(third.getByText("Waiting for the other spellcaster to join…")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("two players complete training and all three monsters with core-hit audio", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const host = await context.newPage();
    const guest = await context.newPage();
    const errors: string[] = [];
    for (const page of [host, guest]) {
      page.on("pageerror", (error) => errors.push(error.message));
      await observeAudio(page);
    }
    await host.goto("/?lite=1");
    await host.getByRole("button", { name: "Create room" }).click();
    const code = await host.locator("h2").filter({ hasText: /^[A-Z2-9]{4}$/ }).textContent();
    await guest.goto("/?lite=1");
    await guest.getByPlaceholder("CODE").fill(code!);
    await guest.getByRole("button", { name: "Join", exact: true }).click();
    for (const page of [host, guest]) await page.getByRole("button", { name: "Grant camera access" }).click();
    await host.getByRole("button", { name: "Start", exact: true }).click();
    const introductions = async () => {
      await expect(host.getByRole("dialog", { name: "Encounter dialogue" })).toBeVisible();
      // The lightweight camera fixture requires explicitly granting access again.
      for (const page of [host, guest]) {
        const grant = page.getByRole("button", { name: "Grant camera access" });
        if (await grant.count()) await grant.click();
      }
      for (let index = 0; index < 3; index++) await host.keyboard.press("3");
      for (const page of [host, guest]) await expect(page.getByRole("dialog", { name: "Encounter dialogue" })).toHaveCount(0);
    };
    const firebolt = async () => { await host.keyboard.press("1"); await host.keyboard.press("2"); };
    const proceed = async () => {
      for (const page of [host, guest]) await page.getByRole("dialog", { name: "Round complete" }).getByRole("button", { name: "Continue", exact: true }).click();
    };
    for (const hits of [2, 3]) {
      await introductions();
      for (let index = 0; index < hits; index++) await firebolt();
      await proceed();
    }
    await introductions();
    await guest.keyboard.down("3");
    await expect(host.getByLabel("Player 2 hand tracking")).toContainText("POINT");
    await firebolt();
    await guest.keyboard.up("3");
    await expect(host.locator(".combat-message")).toContainText("Shield broken");
    for (let index = 0; index < 4; index++) await firebolt();
    await proceed();
    await introductions();
    await host.keyboard.press("2"); await guest.keyboard.press("2");
    await expect(host.locator(".enemy-hud")).toContainText("ARMOR PHASE");
    await host.keyboard.press("3"); await guest.keyboard.press("4");
    await expect(host.locator(".combat-message")).toContainText("Armor shattered once");
    await host.keyboard.press("3"); await guest.keyboard.press("4");
    await expect(host.locator(".enemy-hud")).toContainText("CORE PHASE");
    for (const page of [host, guest]) await page.evaluate(() => { (window as typeof window & { observedAudio: {files:string[]} }).observedAudio.files = []; });
    await firebolt();
    for (const page of [host, guest]) await expectAudioFile(page, "/audio/fireball.mp3");
    await host.keyboard.press("1");
    await guest.keyboard.down("4");
    await expect(host.getByLabel("Player 2 hand tracking")).toContainText("PINCH");
    await host.keyboard.press("2");
    await guest.keyboard.up("4");
    for (const page of [host, guest]) await expect(page.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
    await host.getByRole("button", { name: "Return to lobby" }).click();
    await expect(host.getByRole("heading", { name: "Enter the arena" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
