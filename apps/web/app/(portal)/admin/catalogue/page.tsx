"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { MessageKey } from "@moz/shared";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, Dialog, EmptyState, ErrorSummary, Icon, SelectField, SkeletonRows, TextField, toast, type Problem } from "@/components/ui";

type Row = Record<string, any> & { id: string; active: boolean };
const KINDS = ["issuers", "card-networks", "card-products", "wallet-providers", "premise-categories"] as const;
type Kind = (typeof KINDS)[number];
interface FieldDef { key: string; label: MessageKey; optional?: boolean; type?: "number" | "issuer" | "network" | "cardType" }

const FIELDS: Record<Kind, FieldDef[]> = {
  issuers: [{ key: "name", label: "cat.name" }, { key: "shortName", label: "cat.shortName" }, { key: "logoUrl", label: "cat.logoUrl", optional: true }, { key: "note", label: "cat.note", optional: true }],
  "card-networks": [{ key: "name", label: "cat.name" }, { key: "logoUrl", label: "cat.logoUrl", optional: true }],
  "card-products": [{ key: "issuerId", label: "cat.issuer", type: "issuer" }, { key: "networkId", label: "cat.network", type: "network" }, { key: "cardType", label: "cat.cardType", type: "cardType" }, { key: "segment", label: "cat.segment" }, { key: "name", label: "cat.name" }, { key: "imageUrl", label: "cat.imageUrl", optional: true }, { key: "note", label: "cat.note", optional: true }],
  "wallet-providers": [{ key: "name", label: "cat.name" }, { key: "operator", label: "cat.operator" }, { key: "logoUrl", label: "cat.logoUrl", optional: true }],
  "premise-categories": [{ key: "namePt", label: "cat.namePt" }, { key: "nameEn", label: "cat.nameEn" }, { key: "icon", label: "cat.icon" }, { key: "sortOrder", label: "cat.sortOrder", type: "number" }],
};
const title = (r: Row) => r.name ?? r.namePt;
const sub = (k: Kind, r: Row, issuers: Row[], t: (k: MessageKey) => string) =>
  k === "card-products" ? `${issuers.find((i) => i.id === r.issuerId)?.shortName ?? ""} · ${t(`card.${r.cardType}` as MessageKey)} · ${r.segment}` : k === "wallet-providers" ? r.operator : k === "issuers" ? r.shortName : k === "premise-categories" ? r.nameEn : "";

export default function Page() {
  const { t } = useT();
  const errText = useErrorText();
  const [kind, setKind] = useState<Kind>("issuers");
  const [inactive, setInactive] = useState(false);
  const [rows, setRows] = useState<Row[]>([]); const [issuers, setIssuers] = useState<Row[]>([]); const [networks, setNetworks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [edit, setEdit] = useState<Row | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const qs = inactive ? "?includeInactive=1" : "";
      setRows(await api<Row[]>(`/${kind}${qs}`));
      if (kind === "card-products") { setIssuers(await api<Row[]>("/issuers?includeInactive=1")); setNetworks(await api<Row[]>("/card-networks")); }
    } catch (e) { setError(errText(e)); }
    setLoading(false);
  }, [kind, inactive]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(r: Row) {
    try {
      if (r.active) await api(`/${kind}/${r.id}`, { method: "DELETE" });
      else await api(`/${kind}/${r.id}`, { method: "PATCH", body: { active: true } });
      toast(t("users.done")); await load();
    } catch (e) { toast(errText(e), true); }
  }

  return (
    <>
      <div className="row between"><h1>{t("cat.title")}</h1><button type="button" className="btn" onClick={() => setEdit("new")}><Icon name="plus" size={18} />{t("cat.new")}</button></div>
      <div className="tabs" role="tablist" aria-label={t("cat.title")}>
        {KINDS.map((k) => <button key={k} role="tab" type="button" className="tab" aria-selected={kind === k} onClick={() => setKind(k)}>{t(`cat.${k}` as MessageKey)}</button>)}
      </div>
      <label className="check"><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />{t("cat.showInactive")}</label>
      <p className="hint" style={{ margin: 0 }}>{t("cat.deactivateHint")}</p>
      {error ? <div className="notice bad" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">{t("common.name")}</th><th scope="col">{t("common.details")}</th><th scope="col">{t("common.status")}</th><th scope="col"><span className="sr-only">{t("common.actions")}</span></th></tr></thead>
          <tbody>
            {loading ? <SkeletonRows cols={4} /> : rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{title(r)}</strong>{r.dataOrigin && r.dataOrigin !== "REAL" ? <> <Badge tone="warn">demo</Badge></> : null}</td>
                <td className="muted">{sub(kind, r, issuers, t)}</td>
                <td><Badge tone={r.active ? "good" : "bad"}>{r.active ? t("common.active") : t("common.inactive")}</Badge></td>
                <td><div className="row"><button type="button" className="btn secondary sm" onClick={() => setEdit(r)} aria-label={`${t("common.edit")}: ${title(r)}`}>{t("common.edit")}</button>
                  <button type="button" className="btn ghost sm" onClick={() => toggle(r)} aria-label={`${r.active ? t("cat.deactivate") : t("cat.reactivate")}: ${title(r)}`}>{r.active ? t("cat.deactivate") : t("cat.reactivate")}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && !error ? <EmptyState title={t("cat.empty")} action={<button type="button" className="btn" onClick={() => setEdit("new")}>{t("cat.new")}</button>} /> : null}
      </div>
      <ItemDialog kind={kind} item={edit} issuers={issuers} networks={networks} onClose={() => setEdit(null)} onDone={() => { setEdit(null); void load(); }} />
    </>
  );
}

function ItemDialog({ kind, item, issuers, networks, onClose, onDone }: { kind: Kind; item: Row | "new" | null; issuers: Row[]; networks: Row[]; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const errText = useErrorText();
  const [v, setV] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { setV(item && item !== "new" ? Object.fromEntries(FIELDS[kind].map((f) => [f.key, String(item[f.key] ?? "")])) : { cardType: "DEBIT", sortOrder: "100" }); setProblems([]); }, [item, kind]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const miss = FIELDS[kind].filter((f) => !f.optional && !(v[f.key] ?? "").trim());
    if (miss.length) return setProblems(miss.map((f) => ({ id: `f-${f.key}`, message: `${t(f.label)}: ${t("common.required")}` })));
    const body: Record<string, unknown> = {};
    for (const f of FIELDS[kind]) { const s = (v[f.key] ?? "").trim(); if (s) body[f.key] = f.type === "number" ? Number(s) : s; }
    setBusy(true); setProblems([]);
    try {
      if (item === "new") await api(`/${kind}`, { method: "POST", body });
      else if (item) await api(`/${kind}/${item.id}`, { method: "PATCH", body });
      toast(t("common.saved")); onDone();
    } catch (err) { setProblems([{ message: errText(err) }]); }
    setBusy(false);
  }
  return (
    <Dialog open={item !== null} onClose={onClose} title={t(item === "new" ? "cat.new" : "cat.editTitle")} footer={<><button type="button" className="btn secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" form="cat-form" className="btn" disabled={busy}>{t("common.save")}</button></>}>
      <form id="cat-form" className="stack" onSubmit={submit} noValidate>
        <ErrorSummary problems={problems} />
        {FIELDS[kind].map((f) => {
          const id = `f-${f.key}`; const err = problems.find((p) => p.id === id)?.message;
          const set = (e: { target: { value: string } }) => setV({ ...v, [f.key]: e.target.value });
          if (f.type === "issuer" || f.type === "network" || f.type === "cardType") {
            const opts = f.type === "issuer" ? issuers.filter((i) => i.active).map((i) => [i.id, i.shortName]) : f.type === "network" ? networks.map((n) => [n.id, n.name]) : ["DEBIT", "CREDIT", "PREPAID"].map((c) => [c, t(`card.${c}` as MessageKey)]);
            return <SelectField key={f.key} id={id} label={t(f.label)} value={v[f.key] ?? ""} onChange={set} error={err}><option value="">{t("mybiz.choose")}</option>{opts.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}</SelectField>;
          }
          return <TextField key={f.key} id={id} label={t(f.label)} optional={f.optional} type={f.type === "number" ? "number" : "text"} value={v[f.key] ?? ""} onChange={set} error={err} />;
        })}
      </form>
    </Dialog>
  );
}
