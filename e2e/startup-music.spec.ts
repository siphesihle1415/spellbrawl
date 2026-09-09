import { chromium, expect, test } from "@playwright/test";
import { expectAudioFile, observeAudio } from "./audioProbe";

for (const mode of ["autoplay", "keyboard", "touch"] as const) {
  test(`startup music plays on the entry screen with ${mode}`, async ({ baseURL }) => {
    const browser = await chromium.launch({
      args: [`--autoplay-policy=${mode === "autoplay" ? "no-user-gesture-required" : "document-user-activation-required"}`],
    });
    try {
      const page = await browser.newPage({ hasTouch: mode === "touch" });
      await observeAudio(page);
      await page.goto(`${baseURL}/?lite=1`);
      await expect(page.getByRole("heading", { name: "Enter the arena" })).toBeVisible();
      if (mode === "keyboard") await page.keyboard.press("Tab");
      if (mode === "touch") await page.getByRole("heading", { name: "Enter the arena" }).tap();
      await expectAudioFile(page, "/audio/gamesong.mp3");
      // No room or level has been started to unlock the music.
      await expect(page.getByRole("heading", { name: "Enter the arena" })).toBeVisible();
    } finally {
      await browser.close();
    }
  });
}
