"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, type Locale } from "@moz/shared";
import { setLocaleCookie, useT } from "./i18n";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t, locale } = useT();
  const router = useRouter();
  const other = SUPPORTED_LOCALES.find((l) => l !== locale) as Locale;
  return (
    <main id="main" className="auth">
      <div className="card">
        <Link href="/" className="brand"><img src="/brand/app-icon.png" alt="" /><span>{t("app.name")}</span></Link>
        <h1 style={{ textAlign: "center" }}>{title}</h1>
        {subtitle ? <p className="muted" style={{ textAlign: "center" }}>{subtitle}</p> : null}
        <div className="stack" style={{ marginTop: 16 }}>{children}</div>
        <hr className="rule" />
        <div className="row between">
          <small className="muted">{t("app.tagline")}</small>
          <button type="button" className="btn ghost sm" onClick={() => { setLocaleCookie(other); router.refresh(); }} lang={other}>{other === "en" ? "English" : "Português"}</button>
        </div>
      </div>
    </main>
  );
}

/** Only same-site relative paths are allowed as a post-login target (no open redirect). */
export const safeNext = (n: string | null): string => (n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/dashboard");
