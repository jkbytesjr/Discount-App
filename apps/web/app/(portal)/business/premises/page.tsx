"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, Dialog, EmptyState, ErrorSummary, SelectField, SkeletonRows, TextField, toast, type Problem } from "@/components/ui";
import { MapPicker } from "@/components/map-picker";

interface Premise { id: string; name: string; categoryId: string; address: string | null; city: string | null; province: string | null; lat: number | null; lng: number | null; alertRadiusM: number; openingHours: string | null; phone: string | null; status: "ACTIVE" | "INACTIVE" }
interface Category { id: string; namePt: string; nameEn: string }
interface ImportResult { created: number; errors: { line: number; message: string }[]; dryRun: boolean }
const blank = { name: "", categoryId: "", address: "", city: "", province: "", lat: "", lng: "", alertRadiusM: "150", openingHours: "", phone: "" };
type Form = typeof blank;

export default function Page() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [rows, setRows] = useState<Premise[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [noBiz, setNoBiz] = useState(false);
  const [edit, setEdit] = useState<Premise | "new" | null>(null); const [importing, setImporting] = useState(false);
  const catName = (id: string) => { const c = cats.find((x) => x.id === id); return c ? (locale === "en" ? c.nameEn : c.namePt) : id; };

  const load = useCallback(async (more?: string) => {
    setLoading(true); setError("");
    try {
      const r = await api<{ items: Premise[]; nextCursor: string | null }>(`/premises?${new URLSearchParams({ limit: "25", ...(more ? { cursor: more } : {}) })}`);
      setRows((x) => (more ? [...x, ...r.items] : r.items)); setCursor(r.nextCursor);
    } catch (e) {
      if (e instanceof ApiError && e.code === "NO_BUSINESS") setNoBiz(true); else setError(errText(e));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); api<Category[]>("/premise-categories").then(setCats).catch(() => {}); }, [load]);

  async function toggle(p: Premise) {
    try { await api(`/premises/${p.id}`, { method: "PATCH", body: { status: p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } }); await load(); toast(t("disc.done")); }
    catch (e) { toast(errText(e), true); }
  }

  if (noBiz) return <><h1>{t("prem.title")}</h1><div className="notice" role="status"><p>{t("prem.needBusiness")}</p><Link className="btn" href="/business">{t("prem.goBusiness")}</Link></div></>;
  return (
    <>
      <div className="row between"><h1>{t("prem.title")}</h1><div className="row"><button type="button" className="btn secondary" onClick={() => setImporting(true)}>{t("prem.import")}</button><button type="button" className="btn" onClick={() => setEdit("new")}>{t("prem.add")}</button></div></div>
      {error ? <div className="notice bad" role="alert">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">{t("prem.name")}</th><th scope="col">{t("prem.category")}</th><th scope="col">{t("prem.city")}</th><th scope="col">{t("prem.radius")}</th><th scope="col">{t("common.status")}</th><th scope="col"><span className="sr-only">{t("common.actions")}</span></th></tr></thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={6} /> : rows.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong>{p.lat === null ? <> <Badge tone="warn">{t("prem.noCoords")}</Badge></> : null}</td>
                <td>{catName(p.categoryId)}</td><td>{p.city ?? "–"}</td><td>{p.alertRadiusM}</td>
                <td><Badge tone={p.status === "ACTIVE" ? "good" : undefined}>{t(p.status === "ACTIVE" ? "common.active" : "common.inactive")}</Badge></td>
                <td><div className="row">
                  <button type="button" className="btn secondary sm" onClick={() => setEdit(p)} aria-label={`${t("common.edit")}: ${p.name}`}>{t("common.edit")}</button>
                  <button type="button" className="btn ghost sm" onClick={() => toggle(p)} aria-label={`${t(p.status === "ACTIVE" ? "prem.deactivate" : "prem.activate")}: ${p.name}`}>{t(p.status === "ACTIVE" ? "prem.deactivate" : "prem.activate")}</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && !error ? <EmptyState title={t("prem.empty")} hint={t("prem.emptyHint")} /> : null}
      </div>
      {cursor ? <button type="button" className="btn secondary" onClick={() => load(cursor)} disabled={loading}>{t("common.loadMore")}</button> : null}
      {edit ? <PremiseDrawer premise={edit === "new" ? null : edit} cats={cats} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); toast(t("common.saved")); }} /> : null}
      <ImportDialog open={importing} onClose={() => setImporting(false)} onDone={() => { setImporting(false); void load(); }} />
    </>
  );
}

function PremiseDrawer({ premise, cats, onClose, onSaved }: { premise: Premise | null; cats: Category[]; onClose: () => void; onSaved: () => void }) {
  const { t, locale } = useT();
  const errText = useErrorText();
  const [f, setF] = useState<Form>(premise ? {
    name: premise.name, categoryId: premise.categoryId, address: premise.address ?? "", city: premise.city ?? "", province: premise.province ?? "",
    lat: premise.lat?.toString() ?? "", lng: premise.lng?.toString() ?? "", alertRadiusM: String(premise.alertRadiusM), openingHours: premise.openingHours ?? "", phone: premise.phone ?? "",
  } : blank);
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
  const lat = num(f.lat), lng = num(f.lng);
  const point = lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p: Problem[] = [];
    if (!f.name.trim()) p.push({ id: "p-name", message: `${t("prem.name")}: ${t("common.required")}` });
    if (!f.categoryId) p.push({ id: "p-cat", message: `${t("prem.category")}: ${t("common.required")}` });
    if ((lat === undefined) !== (lng === undefined)) p.push({ id: "p-lat", message: t("err.BAD_COORDINATES") });
    if ((lat !== undefined && !Number.isFinite(lat)) || (lng !== undefined && !Number.isFinite(lng))) p.push({ id: "p-lat", message: t("err.BAD_COORDINATES") });
    const r = Number(f.alertRadiusM);
    if (!Number.isInteger(r) || r < 50 || r > 1000) p.push({ id: "p-radius", message: `${t("prem.radius")}: ${t("prem.radiusHint")}` });
    setProblems(p); if (p.length) return;
    const body: Record<string, unknown> = { name: f.name.trim(), categoryId: f.categoryId, alertRadiusM: r };
    for (const k of ["address", "city", "province", "openingHours", "phone"] as const) { const v = f[k].trim(); if (v) body[k] = v; }
    if (lat !== undefined && lng !== undefined) { body.lat = lat; body.lng = lng; }
    setBusy(true);
    try { await api(premise ? `/premises/${premise.id}` : "/premises", { method: premise ? "PATCH" : "POST", body }); onSaved(); }
    catch (err) { setProblems([{ message: errText(err) }]); setBusy(false); }
  }
  const has = (id: string) => problems.find((x) => x.id === id)?.message;
  return (
    <Dialog drawer open onClose={onClose} title={t(premise ? "prem.edit" : "prem.add")} footer={<><button type="button" className="btn secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" form="premise-form" className="btn" disabled={busy}>{t("common.save")}</button></>}>
      <form id="premise-form" className="stack" onSubmit={submit} noValidate>
        <ErrorSummary problems={problems} />
        <TextField id="p-name" label={t("prem.name")} value={f.name} onChange={set("name")} error={has("p-name")} maxLength={160} />
        <SelectField id="p-cat" label={t("prem.category")} value={f.categoryId} onChange={set("categoryId")} error={has("p-cat")}>
          <option value="">{t("common.all")}</option>{cats.map((c) => <option key={c.id} value={c.id}>{locale === "en" ? c.nameEn : c.namePt}</option>)}
        </SelectField>
        <MapPicker value={point} onPick={(p) => setF((x) => ({ ...x, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6), ...(p.address && !x.address ? { address: p.address } : {}), ...(p.city && !x.city ? { city: p.city } : {}) }))} />
        <div className="grid2">
          <TextField id="p-lat" label={t("prem.lat")} inputMode="decimal" optional value={f.lat} onChange={set("lat")} error={has("p-lat")} hint={t("prem.coordsHint")} />
          <TextField id="p-lng" label={t("prem.lng")} inputMode="decimal" optional value={f.lng} onChange={set("lng")} />
        </div>
        <TextField id="p-address" label={t("prem.address")} optional value={f.address} onChange={set("address")} />
        <div className="grid2">
          <TextField id="p-city" label={t("prem.city")} optional value={f.city} onChange={set("city")} />
          <TextField id="p-province" label={t("prem.province")} optional value={f.province} onChange={set("province")} />
        </div>
        <TextField id="p-radius" label={t("prem.radius")} inputMode="numeric" value={f.alertRadiusM} onChange={set("alertRadiusM")} error={has("p-radius")} hint={t("prem.radiusHint")} />
        <TextField id="p-phone" label={t("prem.phone")} type="tel" optional placeholder="+258841234567" value={f.phone} onChange={set("phone")} />
        <TextField id="p-hours" label={t("prem.hours")} optional value={f.openingHours} onChange={set("openingHours")} maxLength={300} />
      </form>
    </Dialog>
  );
}

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const errText = useErrorText();
  const [csv, setCsv] = useState(""); const [result, setResult] = useState<ImportResult | null>(null); const [busy, setBusy] = useState(false); const [problem, setProblem] = useState("");
  useEffect(() => { if (!open) { setCsv(""); setResult(null); setProblem(""); } }, [open]);
  async function run(dryRun: boolean) {
    setBusy(true); setProblem("");
    try {
      const r = await api<ImportResult>("/premises/import", { method: "POST", body: { csv, dryRun } });
      setResult(r);
      if (!dryRun && !r.errors.length) { toast(t("prem.importOk", { n: r.created })); onDone(); }
    } catch (e) { setProblem(errText(e)); }
    setBusy(false);
  }
  const ready = !!result && result.dryRun && !result.errors.length;
  return (
    <Dialog open={open} onClose={onClose} title={t("prem.import")} footer={<>
      <button type="button" className="btn secondary" onClick={onClose}>{t("common.cancel")}</button>
      <button type="button" className="btn secondary" onClick={() => run(true)} disabled={busy || !csv}>{t("prem.importCheck")}</button>
      <button type="button" className="btn" onClick={() => run(false)} disabled={busy || !ready}>{t("prem.importRun")}</button>
    </>}>
      <p className="hint">{t("prem.importHint")}</p>
      <div className="field">
        <label htmlFor="csv-file">{t("prem.importFile")}</label>
        <input id="csv-file" className="input" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; setResult(null); setCsv(f ? await f.text() : ""); }} />
      </div>
      {problem ? <div className="notice bad" role="alert">{problem}</div> : null}
      {ready ? <div className="notice good" role="status">{t("prem.importValid")}</div> : null}
      {result?.errors.length ? <ErrorSummary problems={result.errors.map((x) => ({ message: `${t("prem.importLine", { n: x.line })}: ${x.message}` }))} /> : null}
    </Dialog>
  );
}
