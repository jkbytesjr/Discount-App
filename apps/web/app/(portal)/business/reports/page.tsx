"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { MessageKey } from "@moz/shared";
import { api, ApiError, download } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, EmptyState, SelectField, SkeletonRows, toast } from "@/components/ui";

interface Row { id: string; titlePt: string; titleEn: string; status: string; impressions: number; alertsSent: number; alertsOpened: number; favourites: number; openRatePct: number | null }
interface Stats { discounts: Row[]; totals: { impressions: number; alertsSent: number; alertsOpened: number; favourites: number; openRatePct: number | null } }

export default function Page() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [days, setDays] = useState("30"); const [s, setS] = useState<Stats | null>(null); const [error, setError] = useState(""); const [noBiz, setNoBiz] = useState(false);
  useEffect(() => { setS(null); api<Stats>(`/businesses/me/stats?days=${days}`).then(setS).catch((e) => { if (e instanceof ApiError && e.code === "NO_BUSINESS") setNoBiz(true); else setError(errText(e)); }); }, [days]);
  if (noBiz) return <><h1>{t("reports.title")}</h1><div className="notice"><p>{t("reports.noBiz")}</p><Link className="btn" href="/business">{t("prem.goBusiness")}</Link></div></>;
  return (
    <>
      <div className="row between"><div><h1>{t("reports.title")}</h1><p className="subtitle">{t("reports.sub")}</p></div>
        <button type="button" className="btn" onClick={() => download(`/businesses/me/report?days=${days}`, "discount-report.xlsx").catch((e) => toast(errText(e), true))}>{t("stats.exportReport")}</button></div>
      <div style={{ maxWidth: 260 }}><SelectField label={t("stats.days", { n: days })} value={days} onChange={(e) => setDays(e.target.value)}>{["7", "14", "30", "90"].map((d) => <option key={d} value={d}>{d}</option>)}</SelectField></div>
      {error ? <div className="notice bad" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">{t("reports.discount")}</th><th scope="col">{t("common.status")}</th><th scope="col" className="num">{t("stats.views")}</th><th scope="col" className="num">{t("stats.sent")}</th><th scope="col" className="num">{t("stats.opened")}</th><th scope="col" className="num">{t("stats.rate")}</th><th scope="col" className="num">{t("stats.favourites")}</th></tr></thead>
          <tbody>
            {!s ? <SkeletonRows cols={7} /> : s.discounts.map((r) => (
              <tr key={r.id}><td><strong>{locale === "en" ? r.titleEn : r.titlePt}</strong></td><td><Badge tone={r.status === "PUBLISHED" ? "good" : undefined}>{t(`dstatus.${r.status}` as MessageKey)}</Badge></td>
                <td className="num">{r.impressions}</td><td className="num">{r.alertsSent}</td><td className="num">{r.alertsOpened}</td><td className="num">{r.openRatePct === null ? "–" : `${r.openRatePct}%`}</td><td className="num">{r.favourites}</td></tr>
            ))}
          </tbody>
          {s?.discounts.length ? <tfoot><tr><th scope="row">Total</th><td /><td className="num">{s.totals.impressions}</td><td className="num">{s.totals.alertsSent}</td><td className="num">{s.totals.alertsOpened}</td><td className="num">{s.totals.openRatePct === null ? "–" : `${s.totals.openRatePct}%`}</td><td className="num">{s.totals.favourites}</td></tr></tfoot> : null}
        </table>
        {s && !s.discounts.length ? <EmptyState title={t("stats.none")} /> : null}
      </div>
    </>
  );
}
