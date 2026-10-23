import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

// BR-11 public map. Google is blocked so the page uses its list fallback (no network dependency); the data comes from the seeded demo set at Wed 2026-11-04 13:00 Maputo.
const WED = "2026-11-04T11:00:00Z";
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/[^/]*(googleapis|gstatic)\.com\//, (r) => r.abort());
  await page.route("**/api/v1/**", (r) => r.continue({ headers: { ...r.request().headers(), "x-test-now": WED } }));
});

test.describe("public map (no login)", () => {
  test("lists active premises, filters by the Absa chip, opens a premise panel", async ({ page }) => {
    await page.goto("/map");
    await expect(page.getByRole("heading", { name: /mapa de descontos|discount map/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/12 locais|12 places/).first()).toBeVisible();
    await expectAccessible(page, "map list");

    await page.getByRole("button", { name: "Absa", exact: true }).click();
    await expect(page.getByText(/3 locais|3 places/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Hotel Polana Serena/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cinema Baía Lazer/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Restaurante Marisco da Baía/ }).click();
    const panel = page.getByRole("complementary");
    await expect(panel.getByText("12% de desconto").first()).toBeVisible();
    await expect(panel.getByText("Absa Wealth Visa Crédito")).toBeVisible();
    await expect(panel.getByText(/Qualquer cartão bancário|Any bank card/)).toBeVisible();
    await expectAccessible(page, "map panel");
    await page.getByRole("button", { name: /fechar detalhes|close details/i }).click();

    await page.getByRole("button", { name: /^mostrar tudo$|^show all$/i }).click();
    await expect(page.getByText(/12 locais|12 places/).first()).toBeVisible();
  });

  test("passes axe in dark mode and fits a phone", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/map");
    await expect(page.getByText(/12 locais|12 places/).first()).toBeVisible();
    await expectAccessible(page, "map dark");
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "fits 375px").toBe(true);
  });
});
