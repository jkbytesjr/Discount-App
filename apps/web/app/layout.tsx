import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Manrope, Montserrat } from "next/font/google";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, translate, type Locale } from "@moz/shared";
import { LocaleProvider } from "@/components/i18n";
import { Toaster } from "@/components/ui";
import { Backdrop } from "@/components/backdrop";
import Link from "next/link";

const display = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], style: ["normal", "italic"], variable: "--font-display-loaded", display: "swap" });
const ui = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-ui-loaded", display: "swap" });

export const viewport = { themeColor: "#07060f", colorScheme: "dark" };
export const metadata = { title: "Moz Discounts", description: "Never miss a discount on your card." };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const raw = (await cookies()).get("moz_locale")?.value;
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : DEFAULT_LOCALE;
  return (
    <html lang={locale} className={`${display.variable} ${ui.variable}`} style={{ ["--font-display" as string]: "var(--font-display-loaded), Manrope, system-ui, sans-serif", ["--font-numeric" as string]: "var(--font-display-loaded), Manrope, system-ui, sans-serif", ["--font-body" as string]: "var(--font-ui-loaded), system-ui, sans-serif" }}>
      <body>
        <Backdrop />
        <a className="skip" href="#main">{translate(locale, "common.skipToContent")}</a>
        <div className="ribbon" role="note">{translate(locale, "demo.ribbon")}</div>
        <LocaleProvider locale={locale}>
          {children}
          <footer className="site-foot">
            <Link href="/privacy">{translate(locale, "app.privacy")}</Link> · <Link href="/privacy#labels">{translate(locale, "app.privacyLabel")}</Link>
          </footer>
          <Toaster />
        </LocaleProvider>
      </body>
    </html>
  );
}
