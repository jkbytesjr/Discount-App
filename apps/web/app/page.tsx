import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@moz/shared";
import { Landing } from "@/components/landing";
import { LANDING } from "@/lib/landing-content";
import { COOKIE } from "@/lib/http";

export async function generateMetadata(): Promise<Metadata> {
  const jar = await cookies(); const raw = jar.get("moz_locale")?.value;
  const c = LANDING[raw === "en" ? "en" : "pt"];
  return { metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"), title: c.title, description: c.description, openGraph: { title: "Moz Discounts", description: c.description, images: ["/site/logo.png"] } };
}

export default async function Home() {
  const jar = await cookies();
  const raw = jar.get("moz_locale")?.value;
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : DEFAULT_LOCALE;
  // Presence of the session cookie only decides which button to show; the dashboard itself still checks the session.
  return <Landing lang={locale === "en" ? "en" : "pt"} signedIn={jar.has(COOKIE)} />;
}
