"use client";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { MessageKey } from "@moz/shared";
import { api, ApiError } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, Confirm, Dialog, EmptyState, ErrorSummary, Icon, SelectField, SkeletonRows, TextField, toast, type Problem } from "@/components/ui";

interface U { id: string; email: string; role: string; status: string; firstName: string; lastName: string; createdAt: string; mfaEnabled: boolean; dataOrigin: string }
interface Detail extends U { activeDevices: number; recentLogins: { success: boolean; failureReason: string | null; ip: string | null; occurredAt: string }[]; businessId: string | null }
type Act = "suspend" | "reactivate" | "force-reset" | "delete";
const tone = (s: string) => (s === "ACTIVE" ? "good" : s === "SUSPENDED" || s === "DELETED" ? "bad" : "warn");

function Users() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [role, setRole] = useState(""); const [status, setStatus] = useState("");
  const [rows, setRows] = useState<U[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [act, setAct] = useState<Act | null>(null); const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (more?: string) => {
    setLoading(true); setError("");
    const qs = new URLSearchParams({ limit: "25", ...(q ? { q } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}), ...(more ? { cursor: more } : {}) });
    try {
      const r = await api<{ items: U[]; nextCursor: string | null }>(`/admin/users?${qs}`);
      setRows((x) => (more ? [...x, ...r.items] : r.items)); setCursor(r.nextCursor);
    } catch (e) { setError(errText(e)); }
    setLoading(false);
  }, [q, role, status]);
  useEffect(() => { const h = setTimeout(() => void load(), 250); return () => clearTimeout(h); }, [load]);

  async function open(id: string) { try { setDetail(await api<Detail>(`/admin/users/${id}`)); } catch (e) { toast(errText(e), true); } }
  async function run() {
    if (!detail || !act) return;
    setBusy(true);
    try {
      await api(`/admin/users/${detail.id}${act === "delete" ? "" : `/${act}`}`, { method: act === "delete" ? "DELETE" : "POST", body: act === "suspend" ? {} : undefined });
      toast(t("users.done")); setAct(null); setDetail(null); await load();
    } catch (e) { toast(errText(e), true); setAct(null); }
    setBusy(false);
  }
  const ACT_TEXT: Record<Act, [MessageKey, MessageKey]> = {
    suspend: ["users.suspend", "users.suspendConfirm"], reactivate: ["users.reactivate", "users.suspendConfirm"],
    "force-reset": ["users.forceReset", "users.resetConfirm"], delete: ["users.delete", "users.deleteConfirm"],
  };

  return (
    <>
      <div className="row between">
        <h1>{t("users.title")}</h1>
        <button type="button" className="btn" onClick={() => setCreating(true)}><Icon name="plus" size={18} />{t("users.new")}</button>
      </div>
      <div className="row" role="search">
        <div style={{ flex: "1 1 240px" }}><TextField label={t("common.search")} type="search" placeholder={t("users.search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <SelectField label={t("common.role")} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t("common.all")}</option>{["ADMIN", "BUSINESS_OWNER", "USER"].map((r) => <option key={r} value={r}>{t(`role.${r}` as MessageKey)}</option>)}
        </SelectField>
        <SelectField label={t("common.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("common.all")}</option>{["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DELETED"].map((s) => <option key={s} value={s}>{t(`ustatus.${s}` as MessageKey)}</option>)}
        </SelectField>
      </div>
      {error ? <div className="notice bad" role="alert">{error} <button type="button" className="btn secondary sm" onClick={() => load()}>{t("common.retry")}</button></div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">{t("common.name")}</th><th scope="col">{t("common.role")}</th><th scope="col">{t("common.status")}</th><th scope="col">{t("common.created")}</th><th scope="col"><span className="sr-only">{t("common.actions")}</span></th></tr></thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={5} /> : rows.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.firstName} {u.lastName}</strong><br /><small className="muted">{u.email}</small></td>
                <td>{t(`role.${u.role}` as MessageKey)}</td>
                <td><Badge tone={tone(u.status)}>{t(`ustatus.${u.status}` as MessageKey)}</Badge></td>
                <td>{fmtDate(u.createdAt, locale)}</td>
                <td><button type="button" className="btn secondary sm" onClick={() => open(u.id)} aria-label={`${t("common.details")}: ${u.email}`}>{t("common.details")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && !error ? <EmptyState title={q || role || status ? t("common.noResults") : t("users.empty")} hint={q || role || status ? t("common.noResultsHint") : undefined} /> : null}
      </div>
      {cursor ? <button type="button" className="btn secondary" onClick={() => load(cursor)} disabled={loading}>{t("common.loadMore")}</button> : null}

      <Dialog drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.firstName} ${detail.lastName}` : ""}>
        {detail ? (
          <>
            <p style={{ margin: 0 }}>{detail.email}</p>
            <div className="row"><Badge>{t(`role.${detail.role}` as MessageKey)}</Badge><Badge tone={tone(detail.status)}>{t(`ustatus.${detail.status}` as MessageKey)}</Badge>{detail.mfaEnabled ? <Badge tone="good">2FA</Badge> : null}{detail.dataOrigin !== "REAL" ? <Badge tone="warn">demo</Badge> : null}</div>
            <p className="muted" style={{ margin: 0 }}>{t("users.devices")}: {detail.activeDevices}</p>
            <h3>{t("users.recentLogins")}</h3>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{detail.recentLogins.map((l, i) => <li key={i}>{fmtDate(l.occurredAt, locale)} · {l.success ? "OK" : l.failureReason} · {l.ip ?? "–"}</li>)}</ul>
            <div className="row">
              {detail.status === "SUSPENDED" ? <button type="button" className="btn secondary" onClick={() => setAct("reactivate")}>{t("users.reactivate")}</button>
                : detail.status !== "DELETED" ? <button type="button" className="btn secondary" onClick={() => setAct("suspend")}>{t("users.suspend")}</button> : null}
              {detail.status !== "DELETED" ? <button type="button" className="btn secondary" onClick={() => setAct("force-reset")}>{t("users.forceReset")}</button> : null}
              {detail.status !== "DELETED" ? <button type="button" className="btn danger" onClick={() => setAct("delete")}>{t("users.delete")}</button> : null}
            </div>
          </>
        ) : null}
      </Dialog>
      {act ? <Confirm open title={t(ACT_TEXT[act][0])} body={t(ACT_TEXT[act][1])} confirmLabel={t(ACT_TEXT[act][0])} danger={act === "delete"} busy={busy} onConfirm={run} onClose={() => setAct(null)} /> : null}
      <CreateUser open={creating} onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />
    </>
  );
}

function CreateUser({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [f, setF] = useState({ email: "", firstName: "", lastName: "", role: "USER" });
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setProblems([]);
    try { await api("/admin/users", { method: "POST", body: { ...f, locale } }); toast(t("users.done")); setF({ email: "", firstName: "", lastName: "", role: "USER" }); onDone(); }
    catch (err) { setProblems([{ id: err instanceof ApiError && err.code === "EMAIL_TAKEN" ? "nu-email" : undefined, message: errText(err) }]); }
    setBusy(false);
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onClose={onClose} title={t("users.new")} footer={<><button type="button" className="btn secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" form="new-user" className="btn" disabled={busy}>{t("common.create")}</button></>}>
      <form id="new-user" className="stack" onSubmit={submit}>
        <ErrorSummary problems={problems} />
        <TextField id="nu-email" label={t("auth.email")} type="email" required value={f.email} onChange={set("email")} />
        <div className="grid2"><TextField label={t("auth.firstName")} required value={f.firstName} onChange={set("firstName")} /><TextField label={t("auth.lastName")} required value={f.lastName} onChange={set("lastName")} /></div>
        <SelectField label={t("common.role")} value={f.role} onChange={set("role")}>{["USER", "BUSINESS_OWNER", "ADMIN"].map((r) => <option key={r} value={r}>{t(`role.${r}` as MessageKey)}</option>)}</SelectField>
        <p className="hint">{t("users.createdHint")}</p>
      </form>
    </Dialog>
  );
}

export default function Page() { return <Suspense><Users /></Suspense>; }
