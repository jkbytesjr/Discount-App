import { expect, test } from "@playwright/test";
import { cleanupE2E, db, expectAccessible, login, makeApprovedOwner, uniq } from "./helpers";

test.beforeAll(cleanupE2E);
test.afterAll(async () => { await cleanupE2E(); await db.$disconnect(); });

const tag = uniq();
const owner = `e2e-dsc-${tag}@mozdiscounts.test`;

// J2 (part): an approved merchant adds a premise and publishes a discount for the restaurant example (BR-7, BR-8, BR-9).
test.describe.serial("premises and discounts", () => {
  test("owner adds a premise (typed coordinates) and imports a CSV", async ({ page }) => {
    await makeApprovedOwner(owner, "E2E Restaurante Baía");
    await login(page, owner);
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/business/premises");
    await expect(page.getByRole("heading", { name: /locais|premises/i, level: 1 })).toBeVisible();
    await expectAccessible(page, "premises empty");

    await page.getByRole("button", { name: /adicionar local|add premise/i }).click();
    await expectAccessible(page, "premise drawer");
    // client-side error summary first
    await page.getByRole("button", { name: /^guardar$|^save$/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /problemas|problems/i })).toBeVisible();
    await page.getByLabel(/nome do local|premise name/i).fill("E2E Marisco da Baía");
    await page.getByLabel(/categoria|category/i).selectOption("restaurant");
    await page.getByLabel(/^latitude/i).fill("-25.948");
    await page.getByLabel(/^longitude/i).fill("32.613");
    await page.getByLabel(/^cidade|^city/i).fill("Maputo");
    await page.getByRole("button", { name: /^guardar$|^save$/i }).click();
    await expect(page.getByRole("cell", { name: /E2E Marisco da Baía/ }).first()).toBeVisible();

    // coordinates outside Mozambique are refused with a readable message
    await page.getByRole("button", { name: /adicionar local|add premise/i }).click();
    await page.getByLabel(/nome do local|premise name/i).fill("E2E Londres");
    await page.getByLabel(/categoria|category/i).selectOption("restaurant");
    await page.getByLabel(/^latitude/i).fill("51.5");
    await page.getByLabel(/^longitude/i).fill("-0.12");
    await page.getByRole("button", { name: /^guardar$|^save$/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /fora de Moçambique|outside Mozambique/i })).toBeVisible();
    await page.getByRole("button", { name: /cancelar|cancel/i }).first().click();

    await page.getByRole("button", { name: /importar csv|import csv/i }).click();
    await expectAccessible(page, "import dialog");
    await page.getByLabel(/ficheiro csv|csv file/i).setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from("name,category,lat,lng\nE2E Filial,Supermercado,-25.95,32.58\nE2E Mau,Inexistente,-25.9,32.5\n") });
    await page.getByRole("button", { name: /^verificar$|^check$/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /linha 3|line 3/i })).toBeVisible();
    await page.getByLabel(/ficheiro csv|csv file/i).setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from("name,category,lat,lng\nE2E Filial,Supermercado,-25.95,32.58\n") });
    await page.getByRole("button", { name: /^verificar$|^check$/i }).click();
    await expect(page.getByText(/ficheiro válido|file is valid/i)).toBeVisible();
    await page.getByRole("button", { name: /^importar$|^import$/i }).click();
    await expect(page.getByRole("cell", { name: /E2E Filial/ }).first()).toBeVisible();
    expect(await db.premise.count({ where: { business: { tradingName: "E2E Restaurante Baía" } } })).toBe(2);
  });

  test("owner builds the restaurant discount in the wizard, previews and publishes it", async ({ page }) => {
    await login(page, owner);
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/business/discounts");
    await expectAccessible(page, "discounts empty");
    await page.getByRole("link", { name: /novo desconto|new discount/i }).first().click();
    await expect(page).toHaveURL(/discounts\/new/);

    await page.getByLabel(/título \(português\)|title \(portuguese\)/i).fill("E2E Almoço executivo");
    await page.getByLabel(/título \(inglês\)|title \(english\)/i).fill("E2E Executive lunch");
    await expectAccessible(page, "wizard basics");

    await page.getByRole("button", { name: /^2\./ }).click();
    await page.getByLabel("E2E Marisco da Baía").check();
    await expectAccessible(page, "wizard premises");

    await page.getByRole("button", { name: /^3\./ }).click();
    await page.getByLabel(/cartão$|^card$/i).first().selectOption("cp-bci-gold");
    await page.getByLabel(/^valor$|^value$/i).first().fill("10");
    await page.getByRole("button", { name: /adicionar linha|add row/i }).click();
    await page.locator("#r1-card").selectOption("cp-absa-wealth");
    await page.locator("#r1-value").fill("12");
    await page.getByRole("button", { name: /adicionar linha|add row/i }).click();
    await page.locator("#r2-scope").selectOption("WALLET");
    await page.locator("#r2-wallet").selectOption("wl-mpesa");
    await page.locator("#r2-value").fill("5");
    await page.getByRole("button", { name: /adicionar linha|add row/i }).click();
    await page.locator("#r3-scope").selectOption("ANY_BANK_CARD");
    await page.locator("#r3-value").fill("3");
    await expectAccessible(page, "wizard eligibility");

    await page.getByRole("button", { name: /^4\./ }).click();
    for (const d of [/^\s*(seg|mon)\s*$/i, /^\s*(ter|tue)\s*$/i, /^\s*(qua|wed)\s*$/i, /^\s*(qui|thu)\s*$/i, /^\s*(sex|fri)\s*$/i]) await page.getByLabel(d).check();
    await page.getByLabel(/^das|^from\b/i).fill("12:00");
    await page.getByLabel(/^às|^to\b/i).fill("15:00");
    await page.getByLabel(/válido até|valid until/i).fill("2099-12-31");
    await expectAccessible(page, "wizard schedule");

    await page.getByRole("button", { name: /^5\./ }).click();
    await page.getByRole("button", { name: /guardar rascunho \+ pré|save draft \+ preview/i }).click();
    await expect(page).toHaveURL(/discounts\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel(/notificação|notification/i)).toContainText(/12% de desconto no E2E Marisco|12% off at E2E Marisco/);
    await expectAccessible(page, "wizard preview");

    await page.getByRole("button", { name: /^6\./ }).click();
    await expectAccessible(page, "wizard publish");
    await page.getByRole("button", { name: /publicar agora|publish now/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /publicar agora|publish now/i }).click();
    await expect(page).toHaveURL(/business\/discounts$/, { timeout: 20_000 });
    await expect(page.getByRole("row", { name: /E2E Almoço executivo|E2E Executive lunch/ }).getByText(/publicado|published/i)).toBeVisible();
    await expectAccessible(page, "discounts list");

    const saved = await db.discount.findFirstOrThrow({ where: { titleEn: "E2E Executive lunch" }, include: { eligibility: true } });
    expect(saved.status).toBe("PUBLISHED");
    expect(saved.eligibility.map((e) => [e.scope, e.value])).toEqual([["CARD_PRODUCT", 10], ["CARD_PRODUCT", 12], ["WALLET", 5], ["ANY_BANK_CARD", 3]]);
    expect(saved.scheduleDays).toEqual(["MON", "TUE", "WED", "THU", "FRI"]);
  });

  test("bulk pause from the list, and the pages fit a phone without horizontal scroll", async ({ page }) => {
    await login(page, owner);
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/business/discounts");
    await page.getByLabel(/seleccionar E2E|select E2E/i).check();
    await page.getByRole("button", { name: /^pausar$|^pause$/i }).click();
    await expect(page.getByRole("row", { name: /E2E/ }).getByText(/em pausa|paused/i)).toBeVisible();
    expect((await db.discount.findFirstOrThrow({ where: { titleEn: "E2E Executive lunch" } })).status).toBe("PAUSED");

    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/business/premises", "/business/discounts", "/business/discounts/new"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} fits 375px`).toBe(true);
    }
  });
});
