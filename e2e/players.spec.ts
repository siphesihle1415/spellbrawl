import { expect, test } from "@playwright/test";

test("startup loader waits for only the initial arena assets", async ({ page }) => {
  const heldModelRequests: import("@playwright/test").Route[] = [];
  await page.route("**/*.glb", (route) => { heldModelRequests.push(route); });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Summoning the arena" })).toBeVisible();
  await expect.poll(() => heldModelRequests.length).toBeGreaterThanOrEqual(5);

  const requestedPaths = heldModelRequests.map((route) => new URL(route.request().url()).pathname);
  expect(requestedPaths).toContain("/models/spellbrawl-three-rooms-open-lighting.glb");
  expect(requestedPaths).toContain("/models/monsters/embermaw-walking.glb");
  expect(requestedPaths.some((path) => path.includes("shard-warden"))).toBe(false);
  expect(requestedPaths.some((path) => path.includes("hexwyrm"))).toBe(false);
  expect(requestedPaths.some((path) => path.endsWith("-a.glb"))).toBe(false);

  await page.waitForTimeout(15_500);
  await expect(page.getByRole("heading", { name: "Summoning the arena" })).toBeVisible();
  await expect(page.getByText("The arena is taking longer than expected to download.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry loading" })).toBeVisible();

  await Promise.allSettled(heldModelRequests.map((route) => route.abort("blockedbyclient")));
  await expect(page.getByText("Some arena assets failed to load.")).toBeVisible();
});

test("two players see the combat HUD, synced gestures, and shared session exit", async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/?lite=1");
  await host.getByRole("button", { name: "Create room" }).click();
  const roomCode = await host.locator("h2").filter({ hasText: /^[A-Z2-9]{4}$/ }).textContent();
  expect(roomCode).toMatch(/^[A-Z2-9]{4}$/);

  await guest.goto("/?lite=1");
  await guest.getByPlaceholder("CODE").fill(roomCode!);
  await guest.getByRole("button", { name: "Join" }).click();

  await expect(host.getByRole("button", { name: "Waiting for cameras" })).toBeDisabled();
  await host.getByLabel("Player 1 hand tracking").getByRole("button", { name: "Grant camera access" }).click();
  await guest.getByLabel("Player 2 hand tracking").getByRole("button", { name: "Grant camera access" }).click();
  await expect(host.getByText("Cameras ready · 2 / 2", { exact: true })).toBeVisible();
  await expect(host.getByRole("button", { name: "Start" })).toBeEnabled();
  await host.screenshot({ path: "test-results/connected-lobby.png", fullPage: true });

  await host.getByRole("button", { name: "Start" }).click();
  await expect(host.getByText("Shared HP", { exact: true })).toBeVisible();
  await expect(guest.getByText("Shared HP", { exact: true })).toBeVisible();
  await expect(host.getByLabel("Spell moves")).toBeVisible();
  await expect(host.locator(".compact-spell").filter({ hasText: "Arcane Shield" })).not.toHaveClass(/is-active/);
  const moveMenuBox = await host.getByLabel("Spell moves").boundingBox();
  expect(moveMenuBox?.width).toBeLessThanOrEqual(320);
  expect((moveMenuBox?.x ?? 0) + (moveMenuBox?.width ?? 0)).toBeGreaterThan(1400);
  await expect(host.getByLabel("Player 1 hand tracking")).toBeVisible();
  await expect(host.getByLabel("Player 2 hand tracking")).toBeVisible();
  await expect(host.locator("video")).toHaveCSS("opacity", "0");

  await host.keyboard.down("1");
  await expect(guest.getByLabel("Player 1 hand tracking")).toContainText("FIST");
  await expect(host.locator(".compact-spell.is-active")).not.toHaveCount(0);
  await host.screenshot({ path: "test-results/firebolt-primed.png", fullPage: true });
  await host.getByRole("button", { name: "Open move help" }).click();
  await expect(host.getByRole("dialog", { name: "Move help" })).toContainText("OPEN PALM within 3 seconds");
  await host.screenshot({ path: "test-results/move-help.png", fullPage: true });
  await host.getByRole("button", { name: "Close move help" }).click();
  await host.keyboard.up("1");
  await expect(guest.getByLabel("Player 1 hand tracking")).toContainText("Waiting");
  await host.setViewportSize({ width: 390, height: 844 });
  await host.screenshot({ path: "test-results/mobile-combat.png", fullPage: true });

  await host.keyboard.press("1");
  await host.keyboard.press("2");
  await expect(host.getByText("2 / 3 HP", { exact: false })).toBeVisible();
  const guestShieldMove = guest.locator(".compact-spell").filter({ hasText: "Arcane Shield" });
  await host.keyboard.press("2");
  await expect(guestShieldMove).toHaveClass(/is-active/);
  await expect(guestShieldMove).not.toHaveClass(/is-active/, { timeout: 5_000 });
  await host.getByRole("button", { name: "Exit lobby" }).click();
  await expect(guest.getByText("The arena session was ended by the other player.")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});

test("spell playground uses one hand tracker and drives the real spell state", async ({ page }) => {
  await page.goto("/?lite=1");
  await page.getByRole("button", { name: "Test Spells" }).click();

  await expect(page.getByRole("heading", { name: "Spell Playground" })).toBeVisible();
  await expect(page.locator(".hand-card")).toHaveCount(1);
  await page.getByLabel("Player 1 hand tracking").getByRole("button", { name: "Grant camera access" }).click();

  const spellPicker = page.getByLabel("Choose a spell to test");
  await expect(spellPicker.getByRole("button")).toHaveCount(7);
  const shieldMove = page.locator(".compact-spell").filter({ hasText: "Arcane Shield" });
  await spellPicker.getByRole("button", { name: "Arcane Shield", exact: true }).click();
  await expect(shieldMove).not.toHaveClass(/is-active/);
  await page.keyboard.press("2");
  await expect(shieldMove).toHaveClass(/is-active/);
  await expect(shieldMove).not.toHaveClass(/is-active/, { timeout: 5_000 });

  await spellPicker.getByRole("button", { name: "Firebolt", exact: true }).click();
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await expect(page.getByText("Firebolt launched!", { exact: true })).toBeVisible();

  const remainingSpells = [
    { name: "Starfall", keys: ["1", "4", "2"], message: "Starfall called down!" },
    { name: "Breath Barrier", keys: ["2", "2"], message: "Co-op breath barrier formed!" },
    { name: "Armor Phase", keys: ["3", "4", "3", "4"], message: "Armor shattered!" },
    { name: "Core Phase", keys: ["1", "2"], message: "Firebolt struck the exposed core!" },
    { name: "Fusion Finisher", keys: ["1", "4", "2"], message: "Fusion Finisher unleashed!" },
  ];
  for (const spell of remainingSpells) {
    await spellPicker.getByRole("button", { name: spell.name, exact: true }).click();
    for (const key of spell.keys) await page.keyboard.press(key);
    await expect(page.getByText(spell.message, { exact: true })).toBeVisible();
  }
  await page.screenshot({ path: "test-results/spell-playground.png", fullPage: true });

  await page.getByRole("button", { name: "Exit playground" }).click();
  await expect(page.getByRole("heading", { name: "Enter the arena" })).toBeVisible();
});
