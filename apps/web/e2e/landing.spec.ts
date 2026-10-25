import { expect, test } from "@playwright/test";
import { cleanupE2E, expectAccessible, login, makeUser, uniq } from "./helpers";

// The parallax marketing page is the home page; every call to action leads into the app.
test.afterAll(cleanupE2E);

test.describe("landing page (/)", () => {
  test("is the main site and its links lead into the web application", async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("O desconto estava");
    for (const [name, url] of [["Entrar", /\/login$/], ["Criar conta", /\/register$/], ["Explorar o mapa", /\/map$/]] as const) {
      await page.goto("/");
      await page.getByRole("link", { name, exact: true }).first().click();
      await expect(page).toHaveURL(url);
    }
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Política de privacidade" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    expect(errors).toEqual([]);
  });

  test("switches between Portuguese and English", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("The discount was");
    await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Português" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("O desconto estava");
  });

  test("the scroll story and walkthroughs respond to scrolling", async ({ page }) => {
    await page.goto("/");
    const at = (sel: string, f: number) => page.evaluate(([s, f]) => { const r = document.querySelector(s as string)!.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + (r.height - innerHeight) * (f as number)); }, [sel, f] as const);
    await at("#story", 0.2); await page.waitForTimeout(300);
    await expect(page.locator("#ch-problem")).toHaveClass(/lp-on/);
    await expect(page.locator("#missed")).not.toHaveText("0");
    await at("#story", 0.8); await page.waitForTimeout(300);
    await expect(page.locator("#ch-solution")).toHaveClass(/lp-on/);
    await at("#ios", 0.9); await page.waitForTimeout(300);
    await expect(page.locator("#ios-steps li").nth(3)).toHaveClass(/lp-on/);
    await at("#web", 0.95); await page.waitForTimeout(300);
    await expect(page.locator("#web-steps li").nth(4)).toHaveClass(/lp-on/);
  });

  test("signed-in visitors get Open dashboard instead of Sign in", async ({ page }) => {
    const email = `e2e-landing-${uniq()}@mozdiscounts.test`; await makeUser(email); await login(page, email);
    await page.waitForURL(/dashboard/);
    await page.goto("/");
    const open = page.getByRole("link", { name: "Abrir painel" }).first();
    await expect(open).toBeVisible();
    await open.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("works on a phone without sideways scrolling", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await ctx.close();
  });

  test("passes axe in Portuguese and English, at several scroll positions", async ({ page }) => {
    await page.goto("/"); await page.waitForTimeout(1500); // let the reveal transitions finish
    for (const [label, sel] of [["top", "#top"], ["story", "#story"], ["ios", "#ios"], ["personal", "#personal"], ["web", "#web"], ["audiences", "#audiences"], ["developers", "#developers"], ["guides", "#guides"]] as const) {
      await page.evaluate((s) => document.querySelector(s)!.scrollIntoView(), sel); await page.waitForTimeout(1300);
      await expectAccessible(page, `/ pt ${label}`);
    }
    await page.getByRole("button", { name: "English" }).click(); await page.waitForTimeout(500); await expectAccessible(page, "/ en");
  });
});
