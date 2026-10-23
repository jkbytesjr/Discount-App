"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { MessageKey } from "@moz/shared";
import { api, download } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, EmptyState, SelectField, SkeletonRows, TextField, toast } from "@/components/ui";

interface Row { id: string; occurredAt: string; actorEmail: string | null; actorRole: string | null; action: string; entityType: string | null; entityId: string | null; summary: string; result: string; changes: unknown }
const blank = { from: "", to: "", action: "", actor: "", result: "" };

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
      const r = await api<{ items: Row[]; nextCursor: string | null }>(`/admin/audit?${new URLSearchParams({ ...Object.fromEntries(params(applied)), limit: "50", ...(more ? { cursor: more } : {}) })}`);
      setRows((x) => (more ? [...x, ...r.items] : r.items)); setCursor(r.nextCursor);
    } catch (e) { setError(errText(e)); }
    setLoading(false);
  }, [applied]);
  useEffect(() => { void load(); }, [load]);

  const submit = (e: FormEvent) => { e.preventDefault(); setApplied(f); };
  async function exportXlsx() {
    setBusy(true);
    try { await download(`/admin/audit/export?${params(applied)}`, "audit-trail.xlsx"); } catch (e) { toast(errText(e), true); }
    setBusy(false);
  }
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <div className="row between"><div><h1>{t("audit.title")}</h1><p className="subtitle">{t("audit.sub")}</p></div>
        <div><button type="button" className="btn" onClick={exportXlsx} disabled={busy}>{t("audit.export")}</button><p className="hint" style={{ margin: "6px 0 0" }}>{t("audit.exportNote")}</p></div></div>
      <form className="card stack" onSubmit={submit} role="search" aria-label={t("audit.filter")}>
        <div className="grid2">
          <TextField id="a-from" type="date" label={t("audit.from")} value={f.from} onChange={set("from")} />
          <TextField id="a-to" type="date" label={t("audit.to")} value={f.to} onChange={set("to")} />
          <TextField id="a-action" label={t("audit.action")} value={f.action} onChange={set("action")} placeholder="discount.publish" />
          <TextField id="a-actor" label={t("audit.actor")} value={f.actor} onChange={set("actor")} />
          <SelectField id="a-result" label={t("audit.result")} value={f.result} onChange={set("result")}><option value="">{t("common.all")}</option><option value="success">{t("audit.rs.success")}</option><option value="failure">{t("audit.rs.failure")}</option></SelectField>
        </div>
        <div className="row"><button className="btn" type="submit">{t("audit.filter")}</button><button type="button" className="btn secondary" onClick={() => { setF(blank); setApplied(blank); }}>{t("audit.clear")}</button></div>
      </form>
      {error ? <div className="notice bad" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">{t("audit.time")}</th><th scope="col">{t("audit.actor")}</th><th scope="col">{t("audit.action")}</th><th scope="col">{t("audit.summary")}</th><th scope="col">{t("audit.result")}</th></tr></thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={5} /> : rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.occurredAt, locale)}</td>
                <td>{r.actorEmail ?? "–"}{r.actorRole ? <><br /><small className="muted">{r.actorRole}</small></> : null}</td>
                <td><code>{r.action}</code></td>
                <td>{r.summary}{r.changes ? <details><summary className="hint">{t("audit.details")}</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: 11, margin: 0 }}>{JSON.stringify(r.changes, null, 1).slice(0, 1500)}</pre></details> : null}</td>
                <td><Badge tone={r.result === "success" ? "good" : "bad"}>{t(`audit.rs.${r.result}` as MessageKey)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && !error ? <EmptyState title={t("audit.empty")} /> : null}
      </div>
      {cursor ? <button type="button" className="btn secondary" onClick={() => load(cursor)} disabled={loading}>{t("common.loadMore")}</button> : null}
    </>
  );
}
