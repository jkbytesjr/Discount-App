"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MessageKey } from "@moz/shared";
import { api, ApiError } from "@/lib/client";
import { useErrorText, useT } from "./i18n";
import { useLiquid } from "./liquid";
import { Badge, Confirm, ErrorSummary, Icon, SelectField, TextArea, TextField, toast, type Problem } from "./ui";

// Discount wizard (BR-7, BR-8, BR-9): 1 basics, 2 premises, 3 eligibility and benefit, 4 schedule, 5 preview, 6 publish.
const SCOPES = ["CARD_PRODUCT", "ISSUER_ANY", "ANY_BANK_CARD", "WALLET", "ANY_WALLET", "GENERAL"] as const;
const BENEFITS = ["PERCENT", "FIXED", "CASHBACK", "BOGO", "FREE_ITEM", "POINTS"] as const;
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const STEPS = ["basics", "premises", "eligibility", "schedule", "preview", "publish"] as const;

interface Row { scope: (typeof SCOPES)[number]; cardProductId: string; issuerId: string; walletId: string; cardType: string; networkId: string; benefit: (typeof BENEFITS)[number]; value: string; valueMzn: string; valueTextPt: string; valueTextEn: string; minSpendMzn: string; maxDiscountMzn: string; commentPt: string; commentEn: string }
interface State { titlePt: string; titleEn: string; descPt: string; descEn: string; termsPt: string; termsEn: string; redPt: string; redEn: string; promoCode: string; isOnline: boolean; premiseIds: string[]; rows: Row[]; validFrom: string; validTo: string; days: string[]; from: string; to: string }
interface Opt { id: string; name: string; shortName?: string; issuerId?: string; cardType?: string; segment?: string }
interface PremiseOpt { id: string; name: string; status: string }
interface ServerRow { scope: Row["scope"]; cardProductId: string | null; issuerId: string | null; walletId: string | null; cardType: string | null; networkId: string | null; benefit: Row["benefit"]; value: number | null; valueMzn: number | null; valueTextPt: string | null; valueTextEn: string | null; minSpendMzn: number | null; maxDiscountMzn: number | null; commentPt: string | null; commentEn: string | null }
export interface DiscountDto {
  id: string; status: string; effectiveStatus: string; titlePt: string; titleEn: string; descriptionPt: string | null; descriptionEn: string | null; termsPt: string | null; termsEn: string | null;
  redemptionPt: string | null; redemptionEn: string | null; promoCode: string | null; validFrom: string | null; validTo: string | null; scheduleDays: string[]; scheduleFrom: string | null; scheduleTo: string | null;
  isOnline: boolean; premises: { premiseId: string }[]; eligibility: ServerRow[];
}
interface Preview { card: { title: string; business: string; premises: string[]; benefit: string; forWho: string; validUntil: string | null; terms: string; redemption: string; promoCode: string | null; moreOffers: number }; notification: { title: string; body: string } }

const emptyRow = (): Row => ({ scope: "CARD_PRODUCT", cardProductId: "", issuerId: "", walletId: "", cardType: "", networkId: "", benefit: "PERCENT", value: "", valueMzn: "", valueTextPt: "", valueTextEn: "", minSpendMzn: "", maxDiscountMzn: "", commentPt: "", commentEn: "" });
const blank = (): State => ({ titlePt: "", titleEn: "", descPt: "", descEn: "", termsPt: "", termsEn: "", redPt: "", redEn: "", promoCode: "", isOnline: false, premiseIds: [], rows: [emptyRow()], validFrom: "", validTo: "", days: [], from: "", to: "" });
const day = (s: string | null) => (s ? s.slice(0, 10) : "");
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function fromDto(d: DiscountDto): State {
  return {
    titlePt: d.titlePt, titleEn: d.titleEn, descPt: d.descriptionPt ?? "", descEn: d.descriptionEn ?? "", termsPt: d.termsPt ?? "", termsEn: d.termsEn ?? "", redPt: d.redemptionPt ?? "", redEn: d.redemptionEn ?? "",
    promoCode: d.promoCode ?? "", isOnline: d.isOnline, premiseIds: d.premises.map((p) => p.premiseId), validFrom: day(d.validFrom), validTo: day(d.validTo), days: d.scheduleDays, from: d.scheduleFrom ?? "", to: d.scheduleTo ?? "",
    rows: d.eligibility.map((e) => ({ scope: e.scope, cardProductId: str(e.cardProductId), issuerId: e.scope === "ISSUER_ANY" ? str(e.issuerId) : "", walletId: str(e.walletId), cardType: str(e.cardType), networkId: str(e.networkId), benefit: e.benefit, value: str(e.value), valueMzn: str(e.valueMzn), valueTextPt: str(e.valueTextPt), valueTextEn: str(e.valueTextEn), minSpendMzn: str(e.minSpendMzn), maxDiscountMzn: str(e.maxDiscountMzn), commentPt: str(e.commentPt), commentEn: str(e.commentEn) })),
  };
}

const n = (s: string) => Number(s.replace(",", "."));
function rowBody(r: Row) {
  const b: Record<string, unknown> = { scope: r.scope, benefit: r.benefit };
  if (r.scope === "CARD_PRODUCT") b.cardProductId = r.cardProductId;
  if (r.scope === "ISSUER_ANY") b.issuerId = r.issuerId;
  if (r.scope === "WALLET") b.walletId = r.walletId;
  if (r.scope === "ISSUER_ANY" || r.scope === "ANY_BANK_CARD") { if (r.cardType) b.cardType = r.cardType; if (r.networkId) b.networkId = r.networkId; }
  if (r.benefit === "PERCENT" || r.benefit === "CASHBACK" || r.benefit === "POINTS") { if (r.value.trim()) b.value = n(r.value); }
  if (r.benefit === "FIXED" && r.valueMzn.trim()) b.valueMzn = n(r.valueMzn);
  if (r.benefit === "FREE_ITEM") b.valueText = { pt: r.valueTextPt.trim(), en: r.valueTextEn.trim() };
  if (r.minSpendMzn.trim()) b.minSpendMzn = n(r.minSpendMzn);
  if ((r.benefit === "PERCENT" || r.benefit === "CASHBACK") && r.maxDiscountMzn.trim()) b.maxDiscountMzn = n(r.maxDiscountMzn);
  if (r.commentPt.trim() || r.commentEn.trim()) b.comment = { ...(r.commentPt.trim() ? { pt: r.commentPt.trim() } : {}), ...(r.commentEn.trim() ? { en: r.commentEn.trim() } : {}) };
  return b;
}
const pair = (pt: string, en: string) => (pt.trim() || en.trim() ? { ...(pt.trim() ? { pt: pt.trim() } : {}), ...(en.trim() ? { en: en.trim() } : {}) } : undefined);
function body(s: State, forUpdate: boolean) {
  const sch = s.days.length || s.from || s.to ? { days: s.days, ...(s.from ? { from: s.from } : {}), ...(s.to ? { to: s.to } : {}) } : forUpdate ? null : undefined;
  return {
    title: { pt: s.titlePt.trim(), en: s.titleEn.trim() },
    description: pair(s.descPt, s.descEn) ?? (forUpdate ? {} : undefined), terms: pair(s.termsPt, s.termsEn) ?? (forUpdate ? {} : undefined), redemption: pair(s.redPt, s.redEn) ?? (forUpdate ? {} : undefined),
    promoCode: s.promoCode.trim() || (forUpdate ? null : undefined), isOnline: s.isOnline, premiseIds: s.premiseIds, eligibility: s.rows.map(rowBody),
    validFrom: s.validFrom || (forUpdate ? null : undefined), validTo: s.validTo || (forUpdate ? null : undefined), schedule: sch,
  };
}

export function DiscountForm({ initial }: { initial?: DiscountDto }) {
  const { t, locale } = useT();
  const errText = useErrorText();
  const router = useRouter();
  const [dto, setDto] = useState<DiscountDto | undefined>(initial);
  const [s, setS] = useState<State>(initial ? fromDto(initial) : blank());
  const [step, setStep] = useState(0);
  const stepsRef = useLiquid<HTMLOListElement>(step);
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  const [premises, setPremises] = useState<PremiseOpt[]>([]); const [cards, setCards] = useState<Opt[]>([]); const [issuers, setIssuers] = useState<Opt[]>([]);
  const [wallets, setWallets] = useState<Opt[]>([]); const [networks, setNetworks] = useState<Opt[]>([]);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [lang, setLang] = useState<"pt" | "en">(locale === "en" ? "en" : "pt"); const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const locked = !!dto && !["DRAFT", "PAUSED", "PUBLISHED"].includes(dto.effectiveStatus);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((x) => ({ ...x, [k]: v }));
  const setRow = (i: number, patch: Partial<Row>) => setS((x) => ({ ...x, rows: x.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  useEffect(() => {
    api<{ items: PremiseOpt[] }>("/premises?limit=100").then((r) => setPremises(r.items.filter((p) => p.status === "ACTIVE" || s.premiseIds.includes(p.id)))).catch(() => {});
    api<{ status: string }>("/businesses/me").then((b) => setApproved(b.status === "APPROVED")).catch(() => setApproved(false));
    api<Opt[]>("/card-products").then(setCards).catch(() => {}); api<Opt[]>("/issuers").then(setIssuers).catch(() => {});
    api<Opt[]>("/wallet-providers").then(setWallets).catch(() => {}); api<Opt[]>("/card-networks").then(setNetworks).catch(() => {});
  }, []);

  const missing = useMemo(() => {
    const m: MessageKey[] = [];
    if (!s.titlePt.trim() || !s.titleEn.trim()) m.push("df.chkTitle");
    if (!s.rows.length) m.push("df.chkRows");
    if (!s.premiseIds.length && !s.isOnline) m.push("df.chkPlace");
    if (approved === false) m.push("df.chkApproved");
    return m;
  }, [s, approved]);

  function explain(e: unknown): Problem[] {
    if (e instanceof ApiError && e.code === "VALIDATION_FAILED" && e.fields.length) return e.fields.map((f) => ({ message: `${f.path}: ${t("err.VALIDATION_FAILED")}` }));
    if (e instanceof ApiError && typeof e.extra.row === "number") return [{ id: `r${e.extra.row}-scope`, message: `${t("df.row", { n: (e.extra.row as number) + 1 })}: ${errText(e)}` }];
    return [{ message: errText(e) }];
  }

  async function save(quiet = false): Promise<DiscountDto | null> {
    if (!s.titlePt.trim() || !s.titleEn.trim()) { setProblems([{ id: "d-titlePt", message: `${t("df.chkTitle")}` }]); setStep(0); return null; }
    setBusy(true); setProblems([]);
    try {
      const saved = dto ? await api<DiscountDto>(`/discounts/${dto.id}`, { method: "PATCH", body: body(s, true) }) : await api<DiscountDto>("/discounts", { method: "POST", body: body(s, false) });
      setDto(saved); setS(fromDto(saved));
      if (!dto) window.history.replaceState(null, "", `/business/discounts/${saved.id}`); // keeps the wizard mounted (router.replace would reset the step)
      if (!quiet) toast(t("df.saved"));
      return saved;
    } catch (e) { setProblems(explain(e)); return null; }
    finally { setBusy(false); }
  }
  async function refreshPreview(l = lang) {
    const saved = await save(true); if (!saved) return;
    setBusy(true);
    try { setPreview(await api<Preview>(`/discounts/${saved.id}/preview?lang=${l}`)); } catch (e) { setProblems(explain(e)); }
    setBusy(false);
  }
  async function publish() {
    const saved = await save(true); if (!saved) { setConfirmPublish(false); return; }
    setBusy(true);
    try { setDto(await api<DiscountDto>(`/discounts/${saved.id}/publish`, { method: "POST" })); toast(t("df.published")); router.push("/business/discounts"); }
    catch (e) { setProblems(explain(e)); setConfirmPublish(false); }
    setBusy(false);
  }

  const has = (id: string) => problems.find((x) => x.id === id)?.message;
  const stepTitle = (i: number) => t(`step.${STEPS[i]!}` as MessageKey);

  return (
    <>
      <div className="row between">
        <h1>{t(dto ? "disc.edit" : "disc.new")}</h1>
        <div className="row">{dto ? <Badge tone={dto.effectiveStatus === "PUBLISHED" ? "good" : undefined}>{t(`dstatus.${dto.effectiveStatus}` as MessageKey)}</Badge> : null}<Link className="btn secondary sm" href="/business/discounts">{t("df.back")}</Link></div>
      </div>
      {approved === false ? <div className="notice" role="status">{t("disc.needApproval")}</div> : null}
      {locked ? <div className="notice" role="status">{t(`dstatus.${dto!.effectiveStatus}` as MessageKey)}</div> : null}

      <nav aria-label={t("disc.title")}>
        <ol className="steps" ref={stepsRef}>
          {STEPS.map((_, i) => (
            <li key={i}><button type="button" className="tab" aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>{i + 1}. {stepTitle(i)}</button></li>
          ))}
        </ol>
      </nav>
      <p className="muted" role="status">{t("step.of", { n: step + 1, total: STEPS.length })}: {stepTitle(step)}</p>
      <ErrorSummary problems={problems} />

      <fieldset className="card stack" disabled={locked} style={{ margin: 0 }}>
        {step === 0 ? (
          <>
            <div className="grid2">
              <TextField id="d-titlePt" label={t("df.titlePt")} value={s.titlePt} onChange={(e) => set("titlePt", e.target.value)} error={has("d-titlePt")} maxLength={120} />
              <TextField id="d-titleEn" label={t("df.titleEn")} value={s.titleEn} onChange={(e) => set("titleEn", e.target.value)} maxLength={120} />
              <TextArea id="d-descPt" label={t("df.descPt")} optional value={s.descPt} onChange={(e) => set("descPt", e.target.value)} maxLength={1000} />
              <TextArea id="d-descEn" label={t("df.descEn")} optional value={s.descEn} onChange={(e) => set("descEn", e.target.value)} maxLength={1000} />
              <TextArea id="d-termsPt" label={t("df.termsPt")} optional value={s.termsPt} onChange={(e) => set("termsPt", e.target.value)} maxLength={2000} />
              <TextArea id="d-termsEn" label={t("df.termsEn")} optional value={s.termsEn} onChange={(e) => set("termsEn", e.target.value)} maxLength={2000} />
              <TextField id="d-redPt" label={t("df.redPt")} optional value={s.redPt} onChange={(e) => set("redPt", e.target.value)} maxLength={300} />
              <TextField id="d-redEn" label={t("df.redEn")} optional value={s.redEn} onChange={(e) => set("redEn", e.target.value)} maxLength={300} />
              <TextField id="d-promo" label={t("df.promo")} optional value={s.promoCode} onChange={(e) => set("promoCode", e.target.value)} maxLength={30} />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label className="check"><input type="checkbox" checked={s.isOnline} onChange={(e) => set("isOnline", e.target.checked)} /> {t("df.online")}</label>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend><strong>{t("df.pickPremises")}</strong></legend>
              {premises.length ? premises.map((p) => (
                <label key={p.id} className="check"><input type="checkbox" checked={s.premiseIds.includes(p.id)} onChange={(e) => set("premiseIds", e.target.checked ? [...s.premiseIds, p.id] : s.premiseIds.filter((x) => x !== p.id))} /> {p.name}</label>
              )) : <p className="muted">{t("df.noPremises")}</p>}
              <Link className="btn secondary sm" href="/business/premises" style={{ justifySelf: "start" }}>{t("df.addPremise")}</Link>
            </fieldset>
          </>
        ) : null}

        {step === 2 ? (
          <>
            {!s.rows.length ? <p className="muted">{t("df.noRows")}</p> : null}
            {s.rows.map((r, i) => (
              <RowEditor key={i} i={i} r={r} cards={cards} issuers={issuers} wallets={wallets} networks={networks} onChange={(p) => setRow(i, p)} onRemove={() => set("rows", s.rows.filter((_, j) => j !== i))} error={has(`r${i}-scope`)} />
            ))}
            <button type="button" className="btn secondary" style={{ justifySelf: "start" }} onClick={() => set("rows", [...s.rows, emptyRow()])}><Icon name="plus" size={16} />{t("df.addRow")}</button>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="grid2">
              <TextField id="d-from" type="date" label={t("df.validFrom")} optional value={s.validFrom} onChange={(e) => set("validFrom", e.target.value)} />
              <TextField id="d-to" type="date" label={t("df.validTo")} optional value={s.validTo} onChange={(e) => set("validTo", e.target.value)} hint={t("df.validToHint")} />
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend><strong>{t("df.days")}</strong></legend>
              <p className="hint">{t("df.daysHint")}</p>
              <div className="row">{DAYS.map((d) => <label key={d} className="check"><input type="checkbox" checked={s.days.includes(d)} onChange={(e) => set("days", e.target.checked ? [...s.days, d] : s.days.filter((x) => x !== d))} /> {t(`day.${d}` as MessageKey)}</label>)}</div>
            </fieldset>
            <div className="grid2">
              <TextField id="d-tfrom" type="time" label={t("df.timeFrom")} optional value={s.from} onChange={(e) => set("from", e.target.value)} />
              <TextField id="d-tto" type="time" label={t("df.timeTo")} optional value={s.to} onChange={(e) => set("to", e.target.value)} hint={t("df.timeHint")} />
            </div>
          </>
        ) : null}
      </fieldset>

      {step === 4 ? (
        <div className="card stack">
          <div className="row">
            <SelectField label={t("df.previewLang")} value={lang} onChange={(e) => { const l = e.target.value as "pt" | "en"; setLang(l); if (preview) void refreshPreview(l); }}><option value="pt">Português</option><option value="en">English</option></SelectField>
            <button type="button" className="btn" disabled={busy || locked} onClick={() => refreshPreview()}>{t("df.saveDraft")} + {t("disc.act.preview")}</button>
          </div>
          {!preview ? <p className="muted">{t("df.previewSave")}</p> : <PreviewView p={preview} />}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="card stack">
          <h2>{t("df.checklist")}</h2>
          <ul className="pw-list">
            {(["df.chkTitle", "df.chkRows", "df.chkPlace", "df.chkApproved"] as MessageKey[]).map((k) => {
              const bad = missing.includes(k);
              return <li key={k} className={bad ? "" : "ok"}><Icon name={bad ? "x" : "check"} size={14} /><span>{t(k)}</span><span className="sr-only">{bad ? "✗" : "✓"}</span></li>;
            })}
          </ul>
          <div className="row"><button type="button" className="btn" disabled={busy || locked || missing.length > 0 || dto?.effectiveStatus === "PUBLISHED"} onClick={() => setConfirmPublish(true)}>{t("df.publishNow")}</button></div>
        </div>
      ) : null}

      <div className="row between">
        <div className="row">
          <button type="button" className="btn secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>{t("step.prev")}</button>
          <button type="button" className="btn secondary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>{t("step.next")}</button>
        </div>
        <button type="button" className="btn" disabled={busy || locked} onClick={() => save()}>{t("df.saveDraft")}</button>
      </div>
      <Confirm open={confirmPublish} title={t("df.publishNow")} body={s.titlePt || s.titleEn} confirmLabel={t("df.publishNow")} busy={busy} onConfirm={publish} onClose={() => setConfirmPublish(false)} />
    </>
  );
}

function PreviewView({ p }: { p: Preview }) {
  const { t } = useT();
  return (
    <div className="grid2">
      <section aria-label={t("df.previewCard")} className="phone-card">
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{p.card.business}</p>
        <h3 style={{ margin: "4px 0" }}>{p.card.title}</h3>
        <p className="big-benefit">{p.card.benefit}</p>
        {p.card.forWho ? <p style={{ margin: 0 }}>{t("df.previewFor", { who: p.card.forWho })}</p> : null}
        {p.card.moreOffers ? <p className="muted" style={{ margin: 0 }}>{t("df.previewMore", { n: p.card.moreOffers })}</p> : null}
        {p.card.premises.length ? <p className="muted" style={{ margin: "8px 0 0" }}>{p.card.premises.join(" · ")}</p> : null}
        {p.card.validUntil ? <p className="muted" style={{ margin: 0 }}>{t("df.previewUntil", { date: p.card.validUntil })}</p> : null}
        {p.card.redemption ? <p style={{ margin: "8px 0 0" }}>{p.card.redemption}</p> : null}
        {p.card.promoCode ? <p style={{ margin: 0 }}><Badge>{p.card.promoCode}</Badge></p> : null}
      </section>
      <section aria-label={t("df.previewNotif")} className="phone-card">
        <p className="muted" style={{ margin: 0, fontSize: ".8rem" }}>{t("app.name")}</p>
        <strong>{p.notification.title}</strong>
        <p style={{ margin: 0 }}>{p.notification.body}</p>
      </section>
    </div>
  );
}

function RowEditor({ i, r, cards, issuers, wallets, networks, onChange, onRemove, error }: { i: number; r: Row; cards: Opt[]; issuers: Opt[]; wallets: Opt[]; networks: Opt[]; onChange: (p: Partial<Row>) => void; onRemove: () => void; error?: string }) {
  const { t } = useT();
  const id = (k: string) => `r${i}-${k}`;
  const issuerName = (x: string) => issuers.find((o) => o.id === x)?.shortName ?? x;
  const filters = r.scope === "ISSUER_ANY" || r.scope === "ANY_BANK_CARD";
  const percent = r.benefit === "PERCENT" || r.benefit === "CASHBACK";
  return (
    <fieldset className="card stack" style={{ margin: 0 }}>
      <legend><strong>{t("df.row", { n: i + 1 })}</strong></legend>
      <div className="grid2">
        <SelectField id={id("scope")} label={t("df.scope")} value={r.scope} error={error} onChange={(e) => onChange({ scope: e.target.value as Row["scope"], cardProductId: "", issuerId: "", walletId: "" })}>
          {SCOPES.map((x) => <option key={x} value={x}>{t(`scope.${x}` as MessageKey)}</option>)}
        </SelectField>
        {r.scope === "CARD_PRODUCT" ? (
          <SelectField id={id("card")} label={t("df.cardProduct")} value={r.cardProductId} onChange={(e) => onChange({ cardProductId: e.target.value })}>
            <option value="">–</option>{cards.map((c) => <option key={c.id} value={c.id}>{issuerName(c.issuerId ?? "")} · {c.name}</option>)}
          </SelectField>
        ) : null}
        {r.scope === "ISSUER_ANY" ? (
          <SelectField id={id("issuer")} label={t("df.issuer")} value={r.issuerId} onChange={(e) => onChange({ issuerId: e.target.value })}>
            <option value="">–</option>{issuers.map((o) => <option key={o.id} value={o.id}>{o.shortName ?? o.name}</option>)}
          </SelectField>
        ) : null}
        {r.scope === "WALLET" ? (
          <SelectField id={id("wallet")} label={t("df.wallet")} value={r.walletId} onChange={(e) => onChange({ walletId: e.target.value })}>
            <option value="">–</option>{wallets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </SelectField>
        ) : null}
        {filters ? (
          <>
            <SelectField id={id("ctype")} label={t("df.cardType")} value={r.cardType} onChange={(e) => onChange({ cardType: e.target.value })}>
              <option value="">{t("df.anyType")}</option>{(["DEBIT", "CREDIT", "PREPAID"] as const).map((x) => <option key={x} value={x}>{t(`ctype.${x}` as MessageKey)}</option>)}
            </SelectField>
            <SelectField id={id("net")} label={t("df.network")} value={r.networkId} onChange={(e) => onChange({ networkId: e.target.value })}>
              <option value="">{t("df.anyNetwork")}</option>{networks.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </SelectField>
          </>
        ) : null}
      </div>
      <div className="grid2">
        <SelectField id={id("benefit")} label={t("df.benefit")} value={r.benefit} onChange={(e) => onChange({ benefit: e.target.value as Row["benefit"] })}>
          {BENEFITS.map((x) => <option key={x} value={x}>{t(`benefit.${x}` as MessageKey)}</option>)}
        </SelectField>
        {percent || r.benefit === "POINTS" ? <TextField id={id("value")} label={t("df.value")} inputMode="decimal" value={r.value} onChange={(e) => onChange({ value: e.target.value })} hint={percent ? "0.01 – 100" : undefined} /> : null}
        {r.benefit === "FIXED" ? <TextField id={id("mzn")} label={t("df.valueMzn")} inputMode="numeric" value={r.valueMzn} onChange={(e) => onChange({ valueMzn: e.target.value })} /> : null}
        {r.benefit === "FREE_ITEM" ? (
          <>
            <TextField id={id("vtpt")} label={t("df.valueTextPt")} value={r.valueTextPt} onChange={(e) => onChange({ valueTextPt: e.target.value })} maxLength={120} />
            <TextField id={id("vten")} label={t("df.valueTextEn")} value={r.valueTextEn} onChange={(e) => onChange({ valueTextEn: e.target.value })} maxLength={120} />
          </>
        ) : null}
        <TextField id={id("min")} label={t("df.minSpend")} optional inputMode="numeric" value={r.minSpendMzn} onChange={(e) => onChange({ minSpendMzn: e.target.value })} />
        {percent ? <TextField id={id("cap")} label={t("df.maxCap")} optional inputMode="numeric" value={r.maxDiscountMzn} onChange={(e) => onChange({ maxDiscountMzn: e.target.value })} /> : null}
      </div>
      <div className="grid2">
        <TextField id={id("cpt")} label={t("df.comment")} optional value={r.commentPt} onChange={(e) => onChange({ commentPt: e.target.value })} maxLength={300} />
        <TextField id={id("cen")} label={t("df.commentEn")} optional value={r.commentEn} onChange={(e) => onChange({ commentEn: e.target.value })} maxLength={300} />
      </div>
      <button type="button" className="btn ghost sm" style={{ justifySelf: "start" }} onClick={onRemove} aria-label={t("df.removeRow", { n: i + 1 })}><Icon name="x" size={16} />{t("df.removeRow", { n: i + 1 })}</button>
    </fieldset>
  );
}
