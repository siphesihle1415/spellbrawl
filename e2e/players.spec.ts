import { expect, test } from "@playwright/test";

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

  await expect(host.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(host.getByText("Tracking paused", { exact: true })).toHaveCount(2);
  await host.screenshot({ path: "test-results/connected-lobby.png", fullPage: true });

  await host.getByRole("button", { name: "Start" }).click();
  await expect(host.getByText("Shared HP", { exact: true })).toBeVisible();
  await expect(guest.getByText("Shared HP", { exact: true })).toBeVisible();
  await expect(host.getByLabel("Spell moves")).toBeVisible();
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
  await expect(host.getByRole("dialog", { name: "Move help" })).toContainText("Deals 1 damage to the current enemy.");
  await host.screenshot({ path: "test-results/move-help.png", fullPage: true });
  await host.getByRole("button", { name: "Close move help" }).click();
  await host.keyboard.up("1");
  await expect(guest.getByLabel("Player 1 hand tracking")).toContainText("Waiting");
  await host.setViewportSize({ width: 390, height: 844 });
  await host.screenshot({ path: "test-results/mobile-combat.png", fullPage: true });

  await host.keyboard.press("2");
  await expect(host.getByText("2 / 3 HP", { exact: false })).toBeVisible();
  await host.getByRole("button", { name: "Exit lobby" }).click();
  await expect(guest.getByText("The arena session was ended by the other player.")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});
