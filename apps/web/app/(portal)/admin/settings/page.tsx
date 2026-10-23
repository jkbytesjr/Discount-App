"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { MessageKey } from "@moz/shared";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { ErrorSummary, TextField, toast, type Problem } from "@/components/ui";

const FIELDS = [
  ["alertRadiusM", 50, 1000], ["cooldownHours", 1, 72], ["dailyCap", 1, 20], ["nearbyRadiusM", 500, 10000], ["recentDays", 7, 90], ["pushDebounceSec", 0, 600], ["purgeUnverifiedDays", 1, 30],
] as const;
type Key = (typeof FIELDS)[number][0];

export default function Page() {
  const { t } = useT();
  const errText = useErrorText();
  const [v, setV] = useState<Record<Key, string> | null>(null); const [demo, setDemo] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => { api<Record<Key, number> & { demoMode: boolean }>("/admin/settings").then((s) => { setV(Object.fromEntries(FIELDS.map(([k]) => [k, String(s[k])])) as Record<Key, string>); setDemo(s.demoMode); }).catch((e) => setProblems([{ message: errText(e) }])); }, []);

  async function save(e: FormEvent) {
    e.preventDefault(); if (!v) return;
    const p: Problem[] = []; const body: Record<string, unknown> = { demoMode: demo };
    for (const [k, min, max] of FIELDS) { const n = Number(v[k]); if (!Number.isFinite(n) || n < min || n > max) p.push({ id: `s-${k}`, message: `${t(`set.${k}` as MessageKey)}: ${t("set.range", { min, max })}` }); else body[k] = n; }
    setProblems(p); if (p.length) return;
    setBusy(true);
    try { await api("/admin/settings", { method: "PUT", body }); toast(t("set.saved")); } catch (err) { setProblems([{ message: errText(err) }]); }
    setBusy(false);
  }
  return (
    <>
      <div><h1>{t("set.title")}</h1><p className="subtitle">{t("set.sub")}</p></div>
      <form className="card stack" onSubmit={save} noValidate>
        <ErrorSummary problems={problems} />
        {v ? (
          <div className="grid2">
            {FIELDS.map(([k, min, max]) => <TextField key={k} id={`s-${k}`} label={t(`set.${k}` as MessageKey)} inputMode="decimal" value={v[k]} hint={t("set.range", { min, max })} onChange={(e) => setV({ ...v, [k]: e.target.value })} error={problems.find((x) => x.id === `s-${k}`)?.message} />)}
          </div>
        ) : <span className="skeleton" style={{ width: 240 }} role="status" aria-label={t("common.loading")} />}
        <label className="check"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />{t("set.demoMode")}</label>
        <div><button className="btn" type="submit" disabled={busy || !v}>{t("common.save")}</button></div>
      </form>
    </>
  );
}
