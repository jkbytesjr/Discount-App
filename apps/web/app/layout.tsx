import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Inter, Playfair_Display } from "next/font/google";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, translate, type Locale } from "@moz/shared";
import { LocaleProvider } from "@/components/i18n";
import { Toaster } from "@/components/ui";

const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display-loaded", display: "swap" });
const ui = Inter({ subsets: ["latin"], variable: "--font-ui-loaded", display: "swap" });

export const metadata = { title: "Moz Discounts", description: "Never miss a discount on your card.", icons: { icon: "/brand/logo.svg" } };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const raw = (await cookies()).get("moz_locale")?.value;
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : DEFAULT_LOCALE;
  return (
    <html lang={locale} className={`${display.variable} ${ui.variable}`} style={{ ["--font-display" as string]: "var(--font-display-loaded), Georgia, serif", ["--font-ui" as string]: "var(--font-ui-loaded), system-ui, sans-serif" }}>
      <body>
        <a className="skip" href="#main">{translate(locale, "common.skipToContent")}</a>
        <div className="ribbon" role="note">{translate(locale, "demo.ribbon")}</div>
        <LocaleProvider locale={locale}>
          {children}
          <Toaster />
        </LocaleProvider>
      </body>
    </html>
  );
}
