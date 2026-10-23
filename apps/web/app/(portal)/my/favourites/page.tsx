"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MessageKey } from "@moz/shared";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, EmptyState, toast } from "@/components/ui";

interface Fav { id: string; titlePt: string; titleEn: string; businessName: string; status: string; validTo: string | null; premises: { id: string; name: string }[] }

export default function Page() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [items, setItems] = useState<Fav[] | null>(null);
  const load = useCallback(() => api<{ items: Fav[] }>("/me/favourites?limit=100").then((r) => setItems(r.items)).catch((e) => { toast(errText(e), true); setItems([]); }), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <>
      <div><h1>{t("my.favTitle")}</h1><p className="subtitle">{t("my.favSub")}</p></div>
      {items && !items.length ? <EmptyState title={t("my.favEmpty")} hint={t("my.favHint")} action={<Link className="btn secondary" href="/map">{t("map.title")}</Link>} /> : null}
      <div className="grid2">
        {(items ?? []).map((f) => (
          <article key={f.id} className="card stack">
            <div className="row between"><strong>{locale === "en" ? f.titleEn : f.titlePt}</strong><Badge tone={f.status === "PUBLISHED" ? "good" : "warn"}>{t(`dstatus.${f.status}` as MessageKey)}</Badge></div>
            <p className="muted" style={{ margin: 0 }}>{f.businessName}{f.premises.length ? ` · ${f.premises.map((p) => p.name).join(", ")}` : ""}</p>
            {f.validTo ? <p className="muted" style={{ margin: 0 }}>{t("map.validUntil", { date: f.validTo.slice(0, 10) })}</p> : null}
            <div><button type="button" className="btn ghost sm" onClick={async () => { try { await api(`/me/favourites/${f.id}`, { method: "DELETE" }); await load(); toast(t("my.removed")); } catch (e) { toast(errText(e), true); } }}>{t("my.unfav")}</button></div>
          </article>
        ))}
      </div>
    </>
  );
}
