import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { LABELS, PRIVACY, PRIVACY_CONTACT, PRIVACY_UPDATED } from "@/lib/privacy-content";

export const metadata: Metadata = { title: "Moz Discounts · Privacy Policy / Política de Privacidade" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const sp = await searchParams;
  const cookieLocale = (await cookies()).get("moz_locale")?.value;
  const lang: "pt" | "en" = sp.lang === "en" || sp.lang === "pt" ? sp.lang : cookieLocale === "en" ? "en" : "pt";
  const doc = PRIVACY[lang]; const lab = LABELS[lang];
  return (
    <main id="main" style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div className="row between" style={{ marginBottom: 16 }}>
        <Link href="/" className="brand"><img src="/brand/app-icon.png" alt="" /><span>Moz Discounts</span></Link>
        <div className="row">
          <Link className={lang === "pt" ? "btn sm" : "btn secondary sm"} href="/privacy?lang=pt" hrefLang="pt">PT</Link>
          <Link className={lang === "en" ? "btn sm" : "btn secondary sm"} href="/privacy?lang=en" hrefLang="en">EN</Link>
        </div>
      </div>
      <article className="card stack" lang={lang}>
        <h1>{doc.title}</h1>
        <p className="muted">{doc.updated}: {PRIVACY_UPDATED}</p>
        <p>{doc.intro}</p>
        {doc.sections.map((s, i) => (
          <section key={s.h} className="stack">
            <h2 style={{ fontSize: 20 }}>{s.h}</h2>
            {s.p?.map((x, j) => (
              <p key={j}>{x}{i === doc.sections.length - 1 && j === s.p!.length - 1 ? <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a> : null}</p>
            ))}
            {s.ul ? <ul>{s.ul.map((x) => <li key={x}>{x}</li>)}</ul> : null}
          </section>
        ))}
        <section id="labels" className="stack" aria-labelledby="labels-h">
          <h2 id="labels-h" style={{ fontSize: 20 }}>{lab.title}</h2>
          <p>{lab.intro}</p>
          <div className="table-wrap">
            <table className="label-table">
              <thead><tr>{lab.cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>{lab.rows.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
            </table>
          </div>
          <p>{lab.notCollected}</p>
          <p><strong>{lab.tracking}</strong></p>
        </section>
      </article>
    </main>
  );
}
