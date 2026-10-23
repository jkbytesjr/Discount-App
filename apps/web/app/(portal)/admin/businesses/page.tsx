"use client";
import { useCallback, useEffect, useState } from "react";
import type { MessageKey } from "@moz/shared";
import { api } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, Confirm, Dialog, EmptyState, ErrorSummary, SkeletonRows, TextArea, toast, type Problem } from "@/components/ui";

interface B { id: string; type: string; tradingName: string; legalName: string | null; status: string; createdAt: string; contactEmail: string | null; contactPhone: string | null; address: string | null; nuit: string | null; description: string | null; website: string | null; rejectionReason: string | null; dataOrigin: string; owner?: { email: string; name: string } | null }
const STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "SUSPENDED", "DRAFT"] as const;
const tone = (s: string) => (s === "APPROVED" ? "good" : s === "REJECTED" || s === "SUSPENDED" ? "bad" : "warn");

export default function Page() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [status, setStatus] = useState<string>("PENDING_APPROVAL");
  const [rows, setRows] = useState<B[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [sel, setSel] = useState<B | null>(null);
  const [act, setAct] = useState<"approve" | "reject" | "suspend" | "reinstate" | null>(null);
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [problems, setProblems] = useState<Problem[]>([]);

  const load = useCallback(async (more?: string) => {
    setLoading(true); setError("");
    try {
      const r = await api<{ items: B[]; nextCursor: string | null }>(`/admin/businesses?${new URLSearchParams({ status, limit: "25", ...(more ? { cursor: more } : {}) })}`);
      setRows((x) => (more ? [...x, ...r.items] : r.items)); setCursor(r.nextCursor);
    } catch (e) { setError(errText(e)); }
    setLoading(false);
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  async function open(id: string) { try { setSel(await api<B>(`/businesses/${id}`)); } catch (e) { toast(errText(e), true); } }
  async function run() {
    if (!sel || !act) return;
    if ((act === "reject" || act === "suspend") && reason.trim().length < 5) { setProblems([{ id: "reason", message: t("biz.rejectHint") }]); return; }
    setBusy(true);
    try {
      await api(`/admin/businesses/${sel.id}/${act}`, { method: "POST", body: act === "reject" || act === "suspend" ? { reason } : undefined });
      toast(t("users.done")); setAct(null); setSel(null); setReason(""); setProblems([]); await load();
    } catch (e) { setProblems([{ message: errText(e) }]); }
    setBusy(false);
  }
  const actions = (b: B) => b.status === "PENDING_APPROVAL" ? (["approve", "reject"] as const) : b.status === "APPROVED" ? (["suspend"] as const) : b.status === "SUSPENDED" ? (["reinstate"] as const) : ([] as const);

  return (
    <>
      <h1>{t("biz.title")}</h1>
      <div className="tabs" role="tablist" aria-label={t("biz.queue")}>
        {STATUSES.map((s) => <button key={s} role="tab" type="button" className="tab" aria-selected={status === s} onClick={() => setStatus(s)}>{t(`bstatus.${s}` as MessageKey)}</button>)}
      </div>
      {error ? <div className="notice bad" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">{t("common.name")}</th><th scope="col">{t("biz.type")}</th><th scope="col">{t("common.status")}</th><th scope="col">{t("common.created")}</th><th scope="col"><span className="sr-only">{t("common.actions")}</span></th></tr></thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={5} /> : rows.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.tradingName}</strong>{b.dataOrigin !== "REAL" ? <> <Badge tone="warn">demo</Badge></> : null}</td>
                <td>{t(`biz.type.${b.type}` as MessageKey)}</td>
                <td><Badge tone={tone(b.status)}>{t(`bstatus.${b.status}` as MessageKey)}</Badge></td>
                <td>{fmtDate(b.createdAt, locale)}</td>
                <td><button type="button" className="btn secondary sm" onClick={() => open(b.id)} aria-label={`${t("common.details")}: ${b.tradingName}`}>{t("common.details")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && !error ? <EmptyState title={t("biz.empty")} /> : null}
      </div>
      {cursor ? <button type="button" className="btn secondary" onClick={() => load(cursor)} disabled={loading}>{t("common.loadMore")}</button> : null}

      <Dialog drawer open={!!sel && !act} onClose={() => setSel(null)} title={sel?.tradingName ?? ""}>
        {sel ? (
          <>
            <div className="row"><Badge>{t(`biz.type.${sel.type}` as MessageKey)}</Badge><Badge tone={tone(sel.status)}>{t(`bstatus.${sel.status}` as MessageKey)}</Badge></div>
            <dl style={{ margin: 0, display: "grid", gap: 8 }}>
              {([["mybiz.legalName", sel.legalName], ["mybiz.nuit", sel.nuit], ["mybiz.contactEmail", sel.contactEmail], ["mybiz.contactPhone", sel.contactPhone], ["mybiz.address", sel.address], ["mybiz.website", sel.website], ["mybiz.description", sel.description], ["biz.owner", sel.owner ? `${sel.owner.name} · ${sel.owner.email}` : null], ["common.reason", sel.rejectionReason]] as [MessageKey, string | null][]).map(([k, v]) => v ? <div key={k}><dt className="muted" style={{ fontSize: ".8rem" }}>{t(k)}</dt><dd style={{ margin: 0 }}>{v}</dd></div> : null)}
            </dl>
            <div className="row">{actions(sel).map((a) => <button key={a} type="button" className={`btn ${a === "approve" || a === "reinstate" ? "" : a === "reject" ? "danger" : "secondary"}`} onClick={() => { setProblems([]); setReason(""); setAct(a); }}>{t(`biz.${a}` as MessageKey)}</button>)}</div>
          </>
        ) : null}
      </Dialog>
      {act === "approve" || act === "reinstate" ? <Confirm open title={t(`biz.${act}` as MessageKey)} body={sel?.tradingName ?? ""} confirmLabel={t(`biz.${act}` as MessageKey)} busy={busy} onConfirm={run} onClose={() => setAct(null)} /> : null}
      <Dialog open={act === "reject" || act === "suspend"} onClose={() => setAct(null)} title={t(act === "suspend" ? "biz.suspend" : "biz.rejectTitle")} footer={<><button type="button" className="btn secondary" onClick={() => setAct(null)}>{t("common.cancel")}</button><button type="button" className="btn danger" onClick={run} disabled={busy}>{t(act === "suspend" ? "biz.suspend" : "biz.reject")}</button></>}>
        <ErrorSummary problems={problems} />
        <TextArea id="reason" label={t("common.reason")} hint={t("biz.rejectHint")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Dialog>
    </>
  );
}
