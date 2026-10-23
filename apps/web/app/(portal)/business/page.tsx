"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { MessageKey } from "@moz/shared";
import { api, ApiError } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, ErrorSummary, SelectField, TextArea, TextField, toast, type Problem } from "@/components/ui";

interface Biz {
  id: string; type: "BANK" | "WALLET_PROVIDER" | "MERCHANT"; status: string; tradingName: string; legalName: string | null; nuit: string | null; brandColor: string | null;
  description: string | null; website: string | null; contactEmail: string | null; contactPhone: string | null; address: string | null;
  issuerId: string | null; walletProviderId: string | null; rejectionReason: string | null;
}
interface Opt { id: string; name: string; shortName?: string }
const EDITABLE = ["legalName", "tradingName", "nuit", "brandColor", "description", "website", "contactEmail", "contactPhone", "address"] as const;
const tone = (s: string) => (s === "APPROVED" ? "good" : s === "REJECTED" || s === "SUSPENDED" ? "bad" : "warn");

export default function Page() {
  const { t } = useT();
  const errText = useErrorText();
  const [biz, setBiz] = useState<Biz | null | undefined>();
  const [issuers, setIssuers] = useState<Opt[]>([]); const [wallets, setWallets] = useState<Opt[]>([]);
  useEffect(() => {
    api<Biz>("/businesses/me").then(setBiz).catch((e) => { if (e instanceof ApiError && e.status === 404) setBiz(null); else toast(errText(e), true); });
    api<Opt[]>("/issuers").then(setIssuers).catch(() => {}); api<Opt[]>("/wallet-providers").then(setWallets).catch(() => {});
  }, []);

  if (biz === undefined) return <span className="skeleton" style={{ width: 240 }} role="status" aria-label={t("common.loading")} />;
  return (
    <>
      <h1>{t("mybiz.title")}</h1>
      {biz === null ? <Create issuers={issuers} wallets={wallets} onCreated={setBiz} /> : <Editor biz={biz} issuers={issuers} wallets={wallets} onChange={setBiz} />}
      <p className="hint">{t("mybiz.logoSoon")}</p>
    </>
  );
}

function Create({ issuers, wallets, onCreated }: { issuers: Opt[]; wallets: Opt[]; onCreated: (b: Biz) => void }) {
  const { t } = useT();
  const errText = useErrorText();
  const [f, setF] = useState({ type: "MERCHANT", tradingName: "", issuerId: "", walletProviderId: "" });
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const p: Problem[] = [];
    if (!f.tradingName.trim()) p.push({ id: "tn", message: `${t("mybiz.tradingName")}: ${t("common.required")}` });
    if (f.type === "BANK" && !f.issuerId) p.push({ id: "iss", message: `${t("mybiz.issuer")}: ${t("common.required")}` });
    if (f.type === "WALLET_PROVIDER" && !f.walletProviderId) p.push({ id: "wal", message: `${t("mybiz.wallet")}: ${t("common.required")}` });
    setProblems(p); if (p.length) return;
    setBusy(true);
    try {
      onCreated(await api<Biz>("/businesses", { method: "POST", body: { type: f.type, tradingName: f.tradingName.trim(), ...(f.type === "BANK" ? { issuerId: f.issuerId } : {}), ...(f.type === "WALLET_PROVIDER" ? { walletProviderId: f.walletProviderId } : {}) } }));
    } catch (err) { setProblems([{ message: errText(err) }]); setBusy(false); }
  }
  const has = (id: string) => problems.find((x) => x.id === id)?.message;
  return (
    <form className="card stack" onSubmit={submit} noValidate style={{ maxWidth: 560 }}>
      <div><h2>{t("mybiz.createTitle")}</h2><p className="muted">{t("mybiz.createSub")}</p></div>
      <ErrorSummary problems={problems} />
      <SelectField label={t("biz.type")} value={f.type} onChange={set("type")}>{(["MERCHANT", "BANK", "WALLET_PROVIDER"] as const).map((x) => <option key={x} value={x}>{t(`biz.type.${x}` as MessageKey)}</option>)}</SelectField>
      <TextField id="tn" label={t("mybiz.tradingName")} value={f.tradingName} onChange={set("tradingName")} error={has("tn")} />
      {f.type === "BANK" ? <SelectField id="iss" label={t("mybiz.issuer")} value={f.issuerId} onChange={set("issuerId")} error={has("iss")}><option value="">{t("mybiz.choose")}</option>{issuers.map((i) => <option key={i.id} value={i.id}>{i.shortName ?? i.name}</option>)}</SelectField> : null}
      {f.type === "WALLET_PROVIDER" ? <SelectField id="wal" label={t("mybiz.wallet")} value={f.walletProviderId} onChange={set("walletProviderId")} error={has("wal")}><option value="">{t("mybiz.choose")}</option>{wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectField> : null}
      <button className="btn" type="submit" disabled={busy}>{t("common.create")}</button>
    </form>
  );
}

function Editor({ biz, issuers, wallets, onChange }: { biz: Biz; issuers: Opt[]; wallets: Opt[]; onChange: (b: Biz) => void }) {
  const { t } = useT();
  const errText = useErrorText();
  const init = () => Object.fromEntries(EDITABLE.map((k) => [k, biz[k] ?? ""])) as Record<(typeof EDITABLE)[number], string>;
  const [v, setV] = useState(init); const [link, setLink] = useState(biz.issuerId ?? biz.walletProviderId ?? "");
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  const locked = biz.status !== "DRAFT" && biz.status !== "REJECTED";
  const set = (k: (typeof EDITABLE)[number]) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  function body() {
    const b: Record<string, unknown> = {};
    for (const k of EDITABLE) { const s = v[k].trim(); if (s) b[k] = s; }
    if (!locked) { if (biz.type === "BANK" && link) b.issuerId = link; if (biz.type === "WALLET_PROVIDER" && link) b.walletProviderId = link; }
    return b;
  }
  const fieldProblems = (e: unknown): Problem[] => e instanceof ApiError && e.code === "VALIDATION_FAILED" && e.fields.length
    ? e.fields.map((f) => ({ id: `b-${f.path}`, message: `${t(`mybiz.${f.path}` as MessageKey)}: ${t("err.VALIDATION_FAILED")}` })) : [{ message: errText(e) }];

  async function save(e?: FormEvent) {
    e?.preventDefault(); setBusy(true); setProblems([]);
    try { onChange(await api<Biz>(`/businesses/${biz.id}`, { method: "PATCH", body: body() })); toast(t("common.saved")); return true; }
    catch (err) { setProblems(fieldProblems(err)); return false; }
    finally { setBusy(false); }
  }
  async function submitForApproval() {
    if (!(await save())) return;
    setBusy(true);
    try { onChange(await api<Biz>(`/businesses/${biz.id}/submit`, { method: "POST" })); toast(t("mybiz.submitted")); }
    catch (err) {
      const missing = err instanceof ApiError && Array.isArray(err.extra.missing) ? (err.extra.missing as string[]) : [];
      setProblems(missing.length ? missing.map((m) => ({ id: `b-${m}`, message: `${t(`mybiz.${m}` as MessageKey)}: ${t("common.required")}` })) : [{ message: errText(err) }]);
    }
    setBusy(false);
  }
  const has = (k: string) => problems.find((x) => x.id === `b-${k}`)?.message;
  const canEdit = biz.status !== "SUSPENDED";

  return (
    <form className="stack" onSubmit={save} noValidate>
      <div className={`notice ${biz.status === "APPROVED" ? "good" : biz.status === "REJECTED" || biz.status === "SUSPENDED" ? "bad" : ""}`} role="status">
        <div className="row"><Badge tone={tone(biz.status)}>{t(`bstatus.${biz.status}` as MessageKey)}</Badge><Badge>{t(`biz.type.${biz.type}` as MessageKey)}</Badge></div>
        <p style={{ margin: "8px 0 0" }}>{t(`mybiz.banner.${biz.status}` as MessageKey)}{biz.status === "REJECTED" && biz.rejectionReason ? ` ${t("common.reason")}: ${biz.rejectionReason}` : ""}</p>
      </div>
      <ErrorSummary problems={problems} />
      <fieldset className="card stack" disabled={!canEdit} style={{ margin: 0 }}>
        {biz.type === "BANK" ? <SelectField label={t("mybiz.issuer")} value={link} onChange={(e) => setLink(e.target.value)} disabled={locked} hint={locked ? t("mybiz.linkLocked") : undefined}>{issuers.map((i) => <option key={i.id} value={i.id}>{i.shortName ?? i.name}</option>)}</SelectField> : null}
        {biz.type === "WALLET_PROVIDER" ? <SelectField label={t("mybiz.wallet")} value={link} onChange={(e) => setLink(e.target.value)} disabled={locked} hint={locked ? t("mybiz.linkLocked") : undefined}>{wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectField> : null}
        <div className="grid2">
          <TextField id="b-tradingName" label={t("mybiz.tradingName")} value={v.tradingName} onChange={set("tradingName")} error={has("tradingName")} />
          <TextField id="b-legalName" label={t("mybiz.legalName")} optional value={v.legalName} onChange={set("legalName")} error={has("legalName")} />
          <TextField id="b-nuit" label={t("mybiz.nuit")} optional inputMode="numeric" value={v.nuit} onChange={set("nuit")} error={has("nuit")} />
          <TextField id="b-brandColor" label={t("mybiz.brandColor")} optional placeholder="#B8955A" value={v.brandColor} onChange={set("brandColor")} error={has("brandColor")} />
          <TextField id="b-contactEmail" label={t("mybiz.contactEmail")} type="email" value={v.contactEmail} onChange={set("contactEmail")} error={has("contactEmail")} />
          <TextField id="b-contactPhone" label={t("mybiz.contactPhone")} type="tel" placeholder="+258841234567" value={v.contactPhone} onChange={set("contactPhone")} error={has("contactPhone")} />
        </div>
        <TextField id="b-address" label={t("mybiz.address")} value={v.address} onChange={set("address")} error={has("address")} />
        <TextField id="b-website" label={t("mybiz.website")} optional type="url" value={v.website} onChange={set("website")} error={has("website")} />
        <TextArea id="b-description" label={t("mybiz.description")} optional value={v.description} onChange={set("description")} error={has("description")} maxLength={2000} />
      </fieldset>
      <div className="row">
        <button className="btn" type="submit" disabled={busy || !canEdit}>{t("common.save")}</button>
        {(biz.status === "DRAFT" || biz.status === "REJECTED") ? <button type="button" className="btn secondary" disabled={busy} onClick={submitForApproval}>{t("mybiz.submit")}</button> : null}
      </div>
    </form>
  );
}
