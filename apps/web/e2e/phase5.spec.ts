import { expect, test } from "@playwright/test";
import { PW, cleanupE2E, db, expectAccessible, login, makeAdmin, makeApprovedOwner, makeUser, uniq } from "./helpers";

test.beforeAll(cleanupE2E);
test.afterAll(async () => { await cleanupE2E(); await db.$disconnect(); });

const tag = uniq();
const adminEmail = `e2e-adm5-${tag}@mozdiscounts.test`;
const ownerEmail = `e2e-own5-${tag}@mozdiscounts.test`;
const userEmail = `e2e-usr5-${tag}@mozdiscounts.test`;

test.describe.serial("Phase 5: audit, settings, reports, user cards", () => {
  test("admin filters the audit trail, exports it to Excel and changes a setting", async ({ page }) => {
    const admin = await makeAdmin(adminEmail);
    await login(page, adminEmail, PW, admin.totp());
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/utilizadores|users/i).first()).toBeVisible();
    await expectAccessible(page, "admin dashboard stats");

    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { level: 1, name: /auditoria|audit/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /auth\.login/ }).first()).toBeVisible();
    await page.getByLabel(/^acção|^action/i).fill("auth.login");
    await page.getByRole("button", { name: /^filtrar$|^filter$/i }).click();
    await expect(page.locator("tbody tr").first()).toContainText("auth.login");
    await expectAccessible(page, "audit");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /exportar excel|export to excel/i }).click()]);
    expect(download.suggestedFilename()).toBe("audit-trail.xlsx");
    expect(await db.auditLog.count({ where: { action: "audit.export", actorEmail: adminEmail } })).toBe(1);

    await page.goto("/admin/settings");
    await page.getByLabel(/limite diário|daily alert cap/i).fill("7");
    await page.getByRole("button", { name: /^guardar$|^save$/i }).click();
    await expect(page.getByText(/definições guardadas|settings saved/i).first()).toBeVisible();
    expect((await db.systemSetting.findUnique({ where: { key: "cfg.dailyCap" } }))!.value).toBe(7);
    await page.getByLabel(/limite diário|daily alert cap/i).fill("99");
    await page.getByRole("button", { name: /^guardar$|^save$/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /problemas|problems/i })).toBeVisible();
    await db.systemSetting.deleteMany({ where: { key: { startsWith: "cfg." } } });

    await page.goto("/admin/alerts");
    await expect(page.getByRole("heading", { level: 1, name: /alertas|alert/i })).toBeVisible();
  });

  test("business owner sees the report page and downloads the Excel report", async ({ page }) => {
    await makeApprovedOwner(ownerEmail, "E2E Relatórios Lda");
    await login(page, ownerEmail);
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/business/reports");
    await expect(page.getByRole("heading", { level: 1, name: /relatórios|reports/i })).toBeVisible();
    await expectAccessible(page, "reports");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /exportar relatório|export excel report/i }).click()]);
    expect(download.suggestedFilename()).toBe("discount-report.xlsx");
  });

  test("a normal user manages cards, wallets and alert preferences, and sees favourites", async ({ page }) => {
    const u = await makeUser(userEmail);
    await login(page, userEmail);
    await expect(page).toHaveURL(/dashboard/);
    await page.getByRole("link", { name: /cartões e carteiras|cards and wallets/i }).first().click();
    await expect(page).toHaveURL(/my\/cards/);
    await expectAccessible(page, "my cards");

    await page.getByLabel(/escolha um cartão|choose a card/i).selectOption("cp-absa-wealth");
    await page.getByLabel(/alcunha|nickname/i).fill("Principal");
    await page.getByRole("button", { name: /adicionar cartão|add card/i }).click();
    await expect(page.getByText("Principal")).toBeVisible();
    await page.getByLabel(/escolha uma carteira|choose a wallet/i).selectOption("wl-mpesa");
    await page.getByRole("button", { name: /adicionar carteira|add wallet/i }).click();
    await expect(page.getByText("M-Pesa").first()).toBeVisible();
    expect(await db.userCard.count({ where: { userId: u.id } })).toBe(1);
    expect(await db.userWallet.count({ where: { userId: u.id } })).toBe(1);

    await page.getByLabel(/que ofertas quer receber|which offers to receive/i).selectOption("ALL");
    await page.getByRole("button", { name: /^guardar$|^save$/i }).click();
    await expect(page.getByText(/preferências guardadas|preferences saved/i).first()).toBeVisible();
    expect((await db.alertPreference.findUnique({ where: { userId: u.id } }))!.mode).toBe("ALL");
    await expectAccessible(page, "my cards filled");

    await page.getByRole("button", { name: /remover: principal|remove: principal/i }).click();
    await expect(page.getByText("Principal")).toHaveCount(0);

    await page.getByRole("link", { name: /favoritos|favourites/i }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /favoritos|favourites/i })).toBeVisible();
    await expect(page.getByText(/ainda não tem favoritos|no favourites yet/i)).toBeVisible();
    await expectAccessible(page, "favourites");
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/my/cards", "/my/favourites", "/dashboard"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} fits 375px`).toBe(true);
    }
  });
});
