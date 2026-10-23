import { expect, test } from "@playwright/test";
import { PW, cleanupE2E, db, expectAccessible, linkIn, login, makeAdmin, uniq, waitForMail } from "./helpers";

test.beforeAll(cleanupE2E);
test.afterAll(async () => { await cleanupE2E(); await db.$disconnect(); });

const tag = uniq();
const owner = `e2e-owner-${tag}@mozdiscounts.test`;
const adminEmail = `e2e-admin-${tag}@mozdiscounts.test`;

test.describe.serial("J1 (part): merchant registers, submits; admin approves", () => {
  test("register -> verify email -> sign in -> create and submit business", async ({ page }) => {
    await page.goto("/register");
    await expectAccessible(page, "register");
    await page.getByLabel(/Negócio|Business/).check();
    await page.getByLabel(/^Nome|^First name/).fill("Maria");
    await page.getByLabel(/Apelido|Last name/).fill("Marisco");
    await page.getByLabel(/^Email/).fill(owner);
    await page.locator("#password").fill(PW);
    await page.locator("#confirm").fill(PW);
    await page.locator("#terms").check();
    await page.getByRole("button", { name: /criar conta|create account/i }).click();
    await expect(page).toHaveURL(/check-email/);

    const mail = await waitForMail(owner, /confirm/i);
    await page.goto(linkIn(mail.html));
    await expect(page.getByRole("status").filter({ hasText: /confirmado|confirmed/i })).toBeVisible();

    await login(page, owner);
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/business");
    await page.getByLabel(/Nome comercial|Trading name/).fill("E2E Restaurante Marisco");
    await page.getByRole("button", { name: /^criar$|^create$/i }).click();
    await expect(page.getByText(/Rascunho|Draft/).first()).toBeVisible();

    // incomplete profile: error summary lists the missing fields and links to them
    await page.getByRole("button", { name: /submeter|submit/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /problemas|problems/i })).toBeVisible();

    await page.getByLabel(/Email de contacto|Contact email/).fill("info@e2e.test");
    await page.getByLabel(/Telefone|Phone/).fill("+258841234567");
    await page.getByLabel(/Morada|address/i).fill("Av. Marginal, Maputo");
    await page.getByRole("button", { name: /submeter|submit/i }).click();
    await expect(page.getByText(/Pendente|Pending/).first()).toBeVisible();
    await expectAccessible(page, "business");
  });

  test("admin signs in with 2FA, approves from the queue; owner sees Approved", async ({ page, browser }) => {
    const admin = await makeAdmin(adminEmail);
    await login(page, adminEmail, PW);
    await page.getByLabel(/código|code/i).fill(admin.totp());
    await page.getByRole("button", { name: /iniciar sessão|sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expectAccessible(page, "admin dashboard");

    await page.goto("/admin/businesses");
    await page.getByRole("button", { name: /E2E Restaurante/ }).click();
    await expectAccessible(page, "business drawer");
    await page.getByRole("button", { name: /^aprovar$|^approve$/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^aprovar$|^approve$/i }).click();
    await expect(page.getByText(/Acção concluída|Done/).first()).toBeVisible();
    expect((await db.business.findFirst({ where: { tradingName: "E2E Restaurante Marisco" } }))!.status).toBe("APPROVED");

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await login(p2, owner);
    await expect(p2).toHaveURL(/dashboard/);
    await p2.goto("/business");
    await expect(p2.getByText(/Aprovado|Approved/).first()).toBeVisible();
    await ctx.close();
  });
});

test.describe("accessibility and responsiveness", () => {
  test("auth pages pass axe in light and dark", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ["/", "/login", "/register", "/forgot-password"]) { await page.goto(path); await expectAccessible(page, `${path} ${scheme}`); }
    }
  });
  test("portal pages pass axe in light and dark (admin)", async ({ page }) => {
    const email = `e2e-axe-${tag}@mozdiscounts.test`;
    const admin = await makeAdmin(email);
    await login(page, email, PW, admin.totp());
    await expect(page).toHaveURL(/dashboard/);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of ["/dashboard", "/admin/users", "/admin/businesses", "/admin/catalogue", "/admin/audit", "/admin/alerts", "/admin/settings", "/account"]) {
        await page.goto(path);
        await expect(page.locator("main#main h1")).toBeVisible();
        await expectAccessible(page, `${path} ${scheme}`);
      }
    }
  });
  test("no horizontal scroll at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    }
  });
  test("login rejects wrong password with a clear, field-linked error", async ({ page }) => {
    await login(page, "nobody@mozdiscounts.test", "Wrong-Passw0rd!");
    const alert = page.locator(".error-summary");
    await expect(alert).toContainText(/incorrect|incorrectos/i);
    await expect(alert).toBeFocused();
  });
});
