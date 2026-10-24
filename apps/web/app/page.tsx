import Link from "next/link";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, translate, SUPPORTED_LOCALES, type Locale } from "@moz/shared";

export default async function Home() {
  const raw = (await cookies()).get("moz_locale")?.value;
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : DEFAULT_LOCALE;
  const t = (k: Parameters<typeof translate>[1]) => translate(locale, k);
  return (
    <main id="main" className="auth">
      <div className="card" style={{ textAlign: "center" }}>
        <img src="/brand/app-icon.png" alt="" width={72} height={72} style={{ borderRadius: 18 }} />
        <h1 style={{ marginTop: 16 }}>{t("app.name")}</h1>
        <p className="muted">{t("app.tagline")}</p>
        <hr className="rule" />
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn" href="/login">{t("auth.login")}</Link>
          <Link className="btn secondary" href="/register">{t("auth.register")}</Link>
          <Link className="btn ghost" href="/map">{t("map.title")}</Link>
        </div>
      </div>
    </main>
  );
}
