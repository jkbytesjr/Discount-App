"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MessageKey } from "@moz/shared";
import { api } from "@/lib/client";
import { useT } from "@/components/i18n";
import { useMe } from "@/components/session";
import { Badge } from "@/components/ui";
import { LineChart } from "@/components/charts";

interface Biz { id: string; status: string; tradingName: string }
interface Pt { date: string; delivered: number; opened: number }
interface AdminStats { users: Record<string, number>; businesses: Record<string, number>; discounts: Record<string, number>; premises: number; favourites: number; alerts: { delivered: number; opened: number; openRatePct: number | null }; series: Pt[]; topDiscounts: { id: string; titlePt: string; titleEn: string; opened: number; delivered: number }[]; topFavourited: { id: string; titlePt: string; titleEn: string; favourites: number }[]; days: number }
interface BizStats { totals: { impressions: number; alertsSent: number; alertsOpened: number; favourites: number; openRatePct: number | null }; series: Pt[]; days: number }
const sum = (o: Record<string, number> | undefined) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${n}%`);

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <section className="card kpi"><span className="eyebrow">{label}</span><span className="stat">{value}</span>{hint ? <span className="subtitle">{hint}</span> : null}</section>;
}

export default function Dashboard() {
  const { t, locale } = useT();
  const { me } = useMe();
  const [admin, setAdmin] = useState<AdminStats | null>(null);
  const [biz, setBiz] = useState<Biz | null | undefined>();
  const [bstats, setBstats] = useState<BizStats | null>(null);

  useEffect(() => {
    if (me.role === "ADMIN" && !me.mfaPending) api<AdminStats>("/admin/stats?days=14").then(setAdmin).catch(() => setAdmin(null));
    if (me.role === "BUSINESS_OWNER") {
      api<Biz>("/businesses/me").then((b) => { setBiz(b); api<BizStats>("/businesses/me/stats?days=14").then(setBstats).catch(() => {}); }).catch(() => setBiz(null));
    }
  }, [me]);

  const title = (x: { titlePt: string; titleEn: string }) => (locale === "en" ? x.titleEn : x.titlePt);
  const chart = (s: Pt[]) => <LineChart title={t("stats.series")} labels={s.map((p) => p.date)} series={[{ label: t("stats.delivered.s"), values: s.map((p) => p.delivered), color: "#19d3ff" }, { label: t("stats.opened.s"), values: s.map((p) => p.opened), color: "#ff2d9b" }]} />;

  return (
    <>
      <div className="hero card">
        <div>
          <p className="eyebrow" style={{ margin: "0 0 8px" }}>{me.role === "ADMIN" ? t("dash.adminSub") : me.role === "BUSINESS_OWNER" ? t("dash.businessSub") : t("my.sub")}</p>
          <h1 style={{ margin: 0 }}>{t("dash.hi")} <span className="accent-word">{me.firstName}</span></h1>
          {me.role === "USER" ? <p style={{ marginTop: 16 }}><Link className="btn" href="/my/cards">{t("nav.myCards")}</Link></p> : null}
        </div>
        <div className="credit-card" aria-hidden="true"><span className="num">•••• •••• •••• 0000</span></div>
      </div>

      {me.role === "ADMIN" && admin ? (
        <>
          <div className="kpis">
            <Kpi label={t("stats.users")} value={sum(admin.users)} hint={Object.entries(admin.users).map(([k, v]) => `${k} ${v}`).join(" · ")} />
            <Kpi label={t("dash.pendingBusinesses")} value={admin.businesses.PENDING_APPROVAL ?? 0} hint={`${t("stats.businesses")}: ${sum(admin.businesses)}`} />
            <Kpi label={t("stats.discounts")} value={sum(admin.discounts)} hint={`${t("dstatus.PUBLISHED")}: ${admin.discounts.PUBLISHED ?? 0}`} />
            <Kpi label={t("stats.premises")} value={admin.premises} />
            <Kpi label={t("stats.delivered")} value={admin.alerts.delivered} hint={t("stats.days", { n: admin.days })} />
            <Kpi label={t("stats.openRate")} value={pct(admin.alerts.openRatePct)} hint={`${t("stats.opened")}: ${admin.alerts.opened}`} />
          </div>
          <section className="card glass-dark" aria-labelledby="ch"><h2 id="ch">{t("stats.series")}</h2><p className="subtitle">{t("stats.days", { n: admin.days })}</p>{chart(admin.series)}</section>
          <div className="grid2">
            <section className="card" aria-labelledby="top1"><h2 id="top1">{t("stats.top")}</h2>
              {admin.topDiscounts.length ? <ul className="elig">{admin.topDiscounts.map((x) => <li key={x.id}><strong>{title(x)}</strong> <span className="muted">· {x.opened} / {x.delivered}</span></li>)}</ul> : <p className="muted">{t("stats.none")}</p>}</section>
            <section className="card" aria-labelledby="top2"><h2 id="top2">{t("stats.topFav")}</h2>
              {admin.topFavourited.length ? <ul className="elig">{admin.topFavourited.map((x) => <li key={x.id}><strong>{title(x)}</strong> <span className="muted">· {x.favourites}</span></li>)}</ul> : <p className="muted">{t("stats.none")}</p>}</section>
          </div>
          <div className="row"><Link className="btn secondary" href="/admin/businesses">{t("dash.openQueue")}</Link><Link className="btn secondary" href="/admin/audit">{t("nav.audit")}</Link></div>
        </>
      ) : null}

      {me.role === "BUSINESS_OWNER" ? (
        <>
          <section className="card">
            {biz === undefined ? <span className="skeleton" style={{ width: 200 }} /> : biz === null ? (
              <><p>{t("dash.setupBusiness")}</p><Link className="btn" href="/business">{t("dash.goBusiness")}</Link></>
            ) : (
              <>
                <h2>{biz.tradingName}</h2>
                <p><Badge tone={biz.status === "APPROVED" ? "good" : biz.status === "REJECTED" || biz.status === "SUSPENDED" ? "bad" : "warn"}>{t(`bstatus.${biz.status}` as MessageKey)}</Badge></p>
                <p>{t(`mybiz.banner.${biz.status}` as MessageKey)}</p>
                <Link className="btn secondary" href="/business">{t("dash.goBusiness")}</Link>
              </>
            )}
          </section>
          {bstats ? (
            <>
              <div className="kpis">
                <Kpi label={t("stats.views")} value={bstats.totals.impressions} hint={t("stats.days", { n: bstats.days })} />
                <Kpi label={t("stats.sent")} value={bstats.totals.alertsSent} />
                <Kpi label={t("stats.opened")} value={bstats.totals.alertsOpened} hint={`${t("stats.rate")}: ${pct(bstats.totals.openRatePct)}`} />
                <Kpi label={t("stats.favourites")} value={bstats.totals.favourites} />
              </div>
              <section className="card glass-dark" aria-labelledby="bch"><h2 id="bch">{t("stats.series")}</h2>{chart(bstats.series)}</section>
              <div><Link className="btn secondary" href="/business/reports">{t("reports.title")}</Link></div>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
