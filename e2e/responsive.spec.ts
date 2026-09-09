import { expect, test, type Page, type Locator } from "@playwright/test";
const sizes = [{width:568,height:320},{width:667,height:375},{width:844,height:390},{width:932,height:430},{width:1024,height:768},{width:1180,height:820},{width:1366,height:768}];
async function inside(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
async function separate(a: Locator, b: Locator) {
  const x = (await a.boundingBox())!; const y = (await b.boundingBox())!;
  expect(x.x + x.width <= y.x + 1 || y.x + y.width <= x.x + 1 || x.y + x.height <= y.y + 1 || y.y + y.height <= x.y + 1).toBe(true);
}
test("landscape loading screens keep director notes readable", async ({page}) => {
  for (const size of sizes) for (const suffix of ["", "?round"]) {
    await page.setViewportSize(size);
    await page.goto(`/e2e/fixtures/responsive-loaders.html${suffix}`);
    await inside(page, page.locator("article"));
    await inside(page, page.locator("article p").last());
    await page.screenshot({path:`test-results/loader-${size.width}${suffix ? '-round' : ''}.png`});
  }
});
test("landscape playground controls fit, scroll and survive rotation", async ({page}) => {
  await page.goto("/?lite=1");
  await page.getByRole("button",{name:"Practice Spells"}).click();
  for (const size of [...sizes, {width:390,height:844}, sizes[0]]) {
    await page.setViewportSize(size);
    const picker = page.getByLabel("Choose a spell to test");
    for (const selector of [".playground-heading", ".playground-spell-picker", ".move-menu", ".playground-camera", ".combat-message"]) await inside(page,page.locator(selector));
    await separate(picker,page.locator(".playground-heading"));
    await separate(picker,page.locator(".playground-camera"));
    await separate(picker,page.locator(".move-menu"));
    await separate(page.locator(".combat-message"),page.locator(".playground-camera"));
    for (const button of await picker.getByRole("button").all()) {
      await button.click();
      await expect(button).toHaveClass("is-selected");
    }
    await page.getByRole("button",{name:"Open move help"}).click();
    await inside(page,page.locator(".spell-help-panel"));
    await page.locator(".spell-legend").scrollIntoViewIfNeeded();
    await page.getByRole("button",{name:"Close move help"}).click();
    await page.screenshot({path:`test-results/landscape-playground-${size.width}.png`});
  }
});
test("landscape multiplayer lobby and combat keep HUD and cameras apart", async ({browser}) => {
  const context = await browser.newContext({viewport:sizes[0]});
  try {
    const host = await context.newPage(); const guest = await context.newPage();
    await host.goto("/?lite=1");
    await inside(host,host.getByRole("button",{name:"Practice Spells"}));
    await host.getByRole("button",{name:"Create room"}).click();
    const code = await host.locator("h2").filter({hasText:/^[A-Z2-9]{4}$/}).textContent();
    await guest.goto("/?lite=1"); await guest.getByPlaceholder("CODE").fill(code!);
    await guest.getByRole("button",{name:"Join",exact:true}).click();
    for (const page of [host,guest]) await page.getByRole("button",{name:"Grant camera access"}).click();
    await inside(host,host.getByRole("button",{name:"Start",exact:true}));
    await host.screenshot({path:"test-results/landscape-lobby.png"});
    await host.getByRole("button",{name:"Start",exact:true}).click();
    await expect(host.getByRole("dialog",{name:"Encounter dialogue"})).toBeVisible();
    for (const page of [host,guest]) { const grant=page.getByRole("button",{name:"Grant camera access"}); if(await grant.count()) await grant.click(); }
    for(let n=0;n<3;n++) await host.keyboard.press("3");
    await expect(host.getByRole("dialog",{name:"Encounter dialogue"})).toHaveCount(0);
    for (const size of sizes) {
      await host.setViewportSize(size);
      for(const selector of [".game-header",".enemy-hud",".team-status",".move-menu",".player-cameras",".combat-message"]) await inside(host,host.locator(selector));
      await separate(host.locator(".move-menu"),host.locator(".player-cameras .hand-card").last());
      await separate(host.locator(".enemy-hud"),host.locator(".team-status"));
      await separate(host.locator(".enemy-hud"),host.locator(".move-menu"));
      await host.screenshot({path:`test-results/landscape-combat-${size.width}.png`});
    }
  } finally { await context.close(); }
});
