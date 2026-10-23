"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MessageKey } from "@moz/shared";
import { api, ApiError } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, Dialog, EmptyState, SkeletonRows, Tabs, TextField, toast } from "@/components/ui";

interface Row { id: string; titlePt: string; titleEn: string; effectiveStatus: string; validFrom: string | null; validTo: string | null; isOnline: boolean; premises: unknown[]; eligibility: unknown[] }
const STATUSES = ["", "DRAFT", "PUBLISHED", "PAUSED", "EXPIRED", "ARCHIVED"] as const;
const ACTIONS = ["publish", "pause", "archive", "duplicate", "extend"] as const;
const tone = (s: string) => (s === "PUBLISHED" ? "good" : s === "EXPIRED" || s === "ARCHIVED" ? undefined : "warn");
const day = (s: string | null) => (s ? s.slice(0, 10) : null);
interface Preview { card: { title: string; benefit: string; forWho: string; business: string }; notification: { title: string; body: string } }

export default function Page() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [status, setStatus] = useState<string>(""); const [q, setQ] = useState(""); const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [noBiz, setNoBiz] = useState(false);
  const [sel, setSel] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const [extend, setExtend] = useState(false); const [until, setUntil] = useState("");
  const [preview, setPreview] = useState<{ title: string; data: Preview } | null>(null);

  const load = useCallback(async (more?: string) => {
    setLoading(true); setError("");
    try {
      const r = await api<{ items: Row[]; nextCursor: string | null }>(`/discounts?${new URLSearchParams({ limit: "25", ...(status ? { status } : {}), ...(query ? { q: query } : {}), ...(more ? { cursor: more } : {}) })}`);
      setRows((x) => (more ? [...x, ...r.items] : r.items)); setCursor(r.nextCursor); if (!more) setSel([]);
    } catch (e) { if (e instanceof ApiError && e.code === "NO_BUSINESS") setNoBiz(true); else setError(errText(e)); }
    setLoading(false);
  }, [status, query]);
  useEffect(() => { void load(); }, [load]);

  const title = (r: Row) => (locale === "en" ? r.titleEn : r.titlePt);
  async function bulk(action: (typeof ACTIONS)[number], validTo?: string) {
    setBusy(true);
    try {
      const { results } = await api<{ results: { id: string; ok: boolean; code?: string }[] }>("/discounts/bulk", { method: "POST", body: { action, ids: sel, ...(validTo ? { validTo } : {}) } });
      const ok = results.filter((r) => r.ok).length; const fail = results.length - ok;
      toast(t("disc.bulkDone", { ok, fail }), fail > 0);
      setExtend(false); await load();
    } catch (e) { toast(errText(e), true); }
    setBusy(false);
  }
  async function showPreview(r: Row) {
    try { setPreview({ title: title(r), data: await api<Preview>(`/discounts/${r.id}/preview?lang=${locale === "en" ? "en" : "pt"}`) }); } catch (e) { toast(errText(e), true); }
  }
  const allOn = rows.length > 0 && sel.length === rows.length;

  if (noBiz) return <><h1>{t("disc.title")}</h1><div className="notice" role="status"><p>{t("disc.needBusiness")}</p><Link className="btn" href="/business">{t("prem.goBusiness")}</Link></div></>;
  return (
    <>
      <div className="row between"><h1>{t("disc.title")}</h1><Link className="btn" href="/business/discounts/new">{t("disc.new")}</Link></div>
      <Tabs label={t("disc.status")} value={status} onChange={setStatus} items={STATUSES.map((s) => ({ key: s, label: s ? t(`dstatus.${s}` as MessageKey) : t("common.all") }))} />
      <form className="row" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
        <div style={{ flex: "1 1 240px" }}><TextField label={t("disc.search")} type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button type="submit" className="btn secondary" style={{ alignSelf: "end" }}>{t("common.search")}</button>
      </form>
      {error ? <div className="notice bad" role="alert">{error}</div> : null}
      {sel.length ? (
        <div className="notice row" role="region" aria-label={t("disc.selected", { n: sel.length })}>
          <strong>{t("disc.selected", { n: sel.length })}</strong>
          {ACTIONS.map((a) => <button key={a} type="button" className="btn secondary sm" disabled={busy} onClick={() => (a === "extend" ? setExtend(true) : bulk(a))}>{t(`disc.act.${a}` as MessageKey)}</button>)}
        </div>
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>
            <th scope="col"><input type="checkbox" className="cb" checked={allOn} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} aria-label={t("disc.selectAll")} /></th>
            <th scope="col">{t("disc.title")}</th><th scope="col">{t("disc.status")}</th><th scope="col">{t("disc.validity")}</th><th scope="col">{t("disc.premises")}</th><th scope="col">{t("disc.offers")}</th>
            <th scope="col"><span className="sr-only">{t("common.actions")}</span></th>
          </tr></thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={7} /> : rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" className="cb" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} aria-label={t("disc.selectRow", { name: title(r) })} /></td>
                <td><strong>{title(r)}</strong>{r.isOnline ? <> <Badge>{t("disc.online")}</Badge></> : null}</td>
                <td><Badge tone={tone(r.effectiveStatus)}>{t(`dstatus.${r.effectiveStatus}` as MessageKey)}</Badge></td>
                <td>{day(r.validFrom) ?? "–"} → {day(r.validTo) ?? t("disc.validityAlways")}</td>
                <td>{r.premises.length}</td><td>{r.eligibility.length}</td>
                <td><div className="row">
                  <Link className="btn secondary sm" href={`/business/discounts/${r.id}`} aria-label={`${t("disc.act.edit")}: ${title(r)}`}>{t("disc.act.edit")}</Link>
                  <button type="button" className="btn ghost sm" onClick={() => showPreview(r)} aria-label={`${t("disc.act.preview")}: ${title(r)}`}>{t("disc.act.preview")}</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && !error ? <EmptyState title={t("disc.empty")} hint={t("disc.emptyHint")} action={<Link className="btn" href="/business/discounts/new">{t("disc.new")}</Link>} /> : null}
      </div>
      {cursor ? <button type="button" className="btn secondary" onClick={() => load(cursor)} disabled={loading}>{t("common.loadMore")}</button> : null}

      <Dialog open={extend} onClose={() => setExtend(false)} title={t("disc.extendTitle")} footer={<><button type="button" className="btn secondary" onClick={() => setExtend(false)}>{t("common.cancel")}</button><button type="button" className="btn" disabled={busy || !until} onClick={() => bulk("extend", until)}>{t("disc.act.extend")}</button></>}>
        <TextField id="extend-to" type="date" label={t("disc.extendTo")} value={until} onChange={(e) => setUntil(e.target.value)} />
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ""}>
        {preview ? (
          <div className="stack">
            <section className="phone-card" aria-label={t("df.previewCard")}><p className="muted" style={{ margin: 0 }}>{preview.data.card.business}</p><p className="big-benefit">{preview.data.card.benefit}</p>{preview.data.card.forWho ? <p style={{ margin: 0 }}>{t("df.previewFor", { who: preview.data.card.forWho })}</p> : null}</section>
            <section className="phone-card" aria-label={t("df.previewNotif")}><strong>{preview.data.notification.title}</strong><p style={{ margin: 0 }}>{preview.data.notification.body}</p></section>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
