"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useT } from "@/components/i18n";
import { useMe } from "@/components/session";
import { Badge } from "@/components/ui";

interface Biz { id: string; status: string; tradingName: string }

export default function Dashboard() {
  const { t } = useT();
  const { me } = useMe();
  const [pending, setPending] = useState<number>();
  const [users, setUsers] = useState<number>();
  const [biz, setBiz] = useState<Biz | null | undefined>();

  useEffect(() => {
    if (me.role === "ADMIN" && !me.mfaPending) {
      api<{ items: unknown[]; nextCursor: string | null }>("/admin/businesses?status=PENDING_APPROVAL&limit=100").then((r) => setPending(r.items.length)).catch(() => setPending(undefined));
      api<{ items: unknown[]; nextCursor: string | null }>("/admin/users?limit=100").then((r) => setUsers(r.items.length)).catch(() => setUsers(undefined));
    }
    if (me.role === "BUSINESS_OWNER") api<Biz>("/businesses/me").then(setBiz).catch(() => setBiz(null));
  }, [me]);

  return (
    <>
      <div>
        <h1>{t("dash.hi")} <span className="accent-word">{me.firstName}</span></h1>
        <p className="muted">{me.role === "ADMIN" ? t("dash.adminSub") : t("dash.businessSub")}</p>
      </div>
      {me.role === "ADMIN" ? (
        <div className="grid2">
          <section className="card" aria-labelledby="d1">
            <h2 id="d1" className="muted" style={{ fontFamily: "var(--font-body)", fontSize: ".9rem" }}>{t("dash.pendingBusinesses")}</h2>
            <p className="stat">{pending ?? "–"}</p>
            <Link className="btn secondary sm" href="/admin/businesses">{t("dash.openQueue")}</Link>
          </section>
          <section className="card" aria-labelledby="d2">
            <h2 id="d2" className="muted" style={{ fontFamily: "var(--font-body)", fontSize: ".9rem" }}>{t("dash.totalUsers")}</h2>
            <p className="stat">{users === undefined ? "–" : users >= 100 ? "100+" : users}</p>
            <Link className="btn secondary sm" href="/admin/users">{t("nav.users")}</Link>
          </section>
        </div>
      ) : null}
      {me.role === "BUSINESS_OWNER" ? (
        <section className="card">
          {biz === undefined ? <span className="skeleton" style={{ width: 200 }} /> : biz === null ? (
            <><p>{t("dash.setupBusiness")}</p><Link className="btn" href="/business">{t("dash.goBusiness")}</Link></>
          ) : (
            <>
              <h2>{biz.tradingName}</h2>
              <p><Badge tone={biz.status === "APPROVED" ? "good" : biz.status === "REJECTED" || biz.status === "SUSPENDED" ? "bad" : "warn"}>{t(`bstatus.${biz.status}` as never)}</Badge></p>
              <p className="muted">{t(`mybiz.banner.${biz.status}` as never)}</p>
              <Link className="btn secondary" href="/business">{t("dash.goBusiness")}</Link>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
