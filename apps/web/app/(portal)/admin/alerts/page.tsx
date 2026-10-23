"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { MessageKey } from "@moz/shared";
import { api, download } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, EmptyState, SelectField, SkeletonRows, TextField, toast } from "@/components/ui";

interface Row { id: string; type: string; reason: string | null; premiseId: string; discountIds: string[]; occurredAt: string; distanceM: number | null; userId: string | null }
const TYPES = ["TRIGGERED", "DELIVERED", "OPENED", "DISMISSED", "DETAIL_VIEWED", "SUPPRESSED"] as const;
const blank = { type: "", premiseId: "", discountId: "", from: "", to: "" };

export default function Page() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [f, setF] = useState(blank); const [applied, setApplied] = useState(blank);
  const [rows, setRows] = useState<Row[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const params = (x: typeof blank) => new URLSearchParams(Object.entries(x).filter(([, v]) => v));
  const load = useCallback(async (more?: string) => {
    setLoading(true); setError("");
    try {
      const r = await api<{ items: Row[]; nextCursor: string | null }>(`/admin/alerts?${new URLSearchParams({ ...Object.fromEntries(params(applied)), limit: "50", ...(more ? { cursor: more } : {}) })}`);
      setRows((x) => (more ? [...x, ...r.items] : r.items)); setCursor(r.nextCursor);
    } catch (e) { setError(errText(e)); }
    setLoading(false);
  }, [applied]);
  useEffect(() => { void load(); }, [load]);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function exportXlsx() { setBusy(true); try { await download(`/admin/alerts/export?${params(applied)}`, "alert-events.xlsx"); } catch (e) { toast(errText(e), true); } setBusy(false); }

  return (
    <>
      <div className="row between"><div><h1>{t("alerts.title")}</h1><p className="subtitle">{t("alerts.sub")}</p></div><button type="button" className="btn" onClick={exportXlsx} disabled={busy}>{t("audit.export")}</button></div>
      <form className="card stack" onSubmit={(e: FormEvent) => { e.preventDefault(); setApplied(f); }} role="search" aria-label={t("audit.filter")}>
        <div className="grid2">
          <SelectField id="e-type" label={t("alerts.type")} value={f.type} onChange={set("type")}><option value="">{t("common.all")}</option>{TYPES.map((x) => <option key={x} value={x}>{t(`alerts.ty.${x}` as MessageKey)}</option>)}</SelectField>
          <TextField id="e-premise" label={t("alerts.premise")} value={f.premiseId} onChange={set("premiseId")} />
          <TextField id="e-discount" label={t("alerts.discount")} value={f.discountId} onChange={set("discountId")} />
          <TextField id="e-from" type="date" label={t("audit.from")} value={f.from} onChange={set("from")} />
          <TextField id="e-to" type="date" label={t("audit.to")} value={f.to} onChange={set("to")} />
        </div>
        <div className="row"><button className="btn" type="submit">{t("audit.filter")}</button><button type="button" className="btn secondary" onClick={() => { setF(blank); setApplied(blank); }}>{t("audit.clear")}</button></div>
      </form>
      {error ? <div className="notice bad" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">{t("audit.time")}</th><th scope="col">{t("alerts.type")}</th><th scope="col">{t("alerts.premise")}</th><th scope="col">{t("alerts.discount")}</th><th scope="col" className="num">{t("alerts.distance")}</th><th scope="col">{t("alerts.reason")}</th></tr></thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={6} /> : rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.occurredAt, locale)}</td>
                <td><Badge tone={r.type === "OPENED" ? "good" : r.type === "SUPPRESSED" ? "warn" : undefined}>{t(`alerts.ty.${r.type}` as MessageKey)}</Badge></td>
                <td><code>{r.premiseId}</code></td><td>{r.discountIds.map((d) => <code key={d}>{d} </code>)}</td>
                <td className="num">{r.distanceM ?? "–"}</td><td>{r.reason ? t(`alerts.re.${r.reason}` as MessageKey) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && !error ? <EmptyState title={t("alerts.empty")} /> : null}
      </div>
      {cursor ? <button type="button" className="btn secondary" onClick={() => load(cursor)} disabled={loading}>{t("common.loadMore")}</button> : null}
    </>
  );
}
