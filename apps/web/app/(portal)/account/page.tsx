"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { checkPassword } from "@moz/shared";
import { api, ApiError, setCsrf } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { useErrorText, useT } from "@/components/i18n";
import { useMe } from "@/components/session";
import { Badge, Confirm, ErrorSummary, PasswordChecklist, TextField, toast, type Problem } from "@/components/ui";

export default function Page() {
  const { t } = useT();
  const { me } = useMe();
  return (
    <>
      <h1>{t("acct.title")}</h1>
      {me.mfaPending ? <div className="notice bad" role="alert"><strong>{t("acct.mfaRequiredAdmin")}</strong></div> : null}
      <Mfa />
      {!me.mfaPending ? (<><Profile /><Password /><Email /><Devices /><Danger /></>) : null}
    </>
  );
}

function useForm() {
  const errText = useErrorText();
  const [problems, setProblems] = useState<Problem[]>([]); const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>, fieldFor?: (e: unknown) => string | undefined) {
    setBusy(true); setProblems([]);
    try { await fn(); } catch (e) { setProblems([{ id: fieldFor?.(e), message: errText(e) }]); }
    setBusy(false);
  }
  return { problems, setProblems, busy, run };
}

function Profile() {
  const { t } = useT(); const { me, reload } = useMe(); const f = useForm();
  const [v, setV] = useState({ firstName: me.firstName, lastName: me.lastName, phone: me.phone ?? "" });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const submit = (e: FormEvent) => { e.preventDefault(); void f.run(async () => { await api("/me", { method: "PATCH", body: { firstName: v.firstName, lastName: v.lastName, phone: v.phone.trim() || null } }); await reload(); toast(t("common.saved")); }, (er) => (er instanceof ApiError && er.code === "VALIDATION_FAILED" ? "phone" : undefined)); };
  return (
    <form className="card stack" onSubmit={submit} noValidate aria-labelledby="h-profile">
      <h2 id="h-profile">{t("acct.profile")}</h2>
      <ErrorSummary problems={f.problems} />
      <div className="grid2"><TextField label={t("auth.firstName")} value={v.firstName} onChange={set("firstName")} /><TextField label={t("auth.lastName")} value={v.lastName} onChange={set("lastName")} /></div>
      <TextField id="phone" label={t("acct.phone")} optional type="tel" placeholder="+258841234567" value={v.phone} onChange={set("phone")} />
      <div><button className="btn" type="submit" disabled={f.busy}>{t("common.save")}</button></div>
    </form>
  );
}

function Password() {
  const { t } = useT(); const f = useForm();
  const [cur, setCur] = useState(""); const [pw, setPw] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault();
    if (checkPassword(pw).length) return f.setProblems([{ id: "pw-new", message: t("err.PASSWORD_WEAK") }]);
    void f.run(async () => { await api("/me/change-password", { method: "POST", body: { currentPassword: cur, newPassword: pw } }); setCur(""); setPw(""); toast(t("acct.passwordChanged")); }, (er) => (er instanceof ApiError && er.code === "INVALID_CREDENTIALS" ? "pw-cur" : undefined)); };
  return (
    <form className="card stack" onSubmit={submit} noValidate aria-labelledby="h-pw">
      <h2 id="h-pw">{t("acct.changePassword")}</h2>
      <ErrorSummary problems={f.problems} />
      <TextField id="pw-cur" label={t("acct.currentPassword")} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <TextField id="pw-new" label={t("auth.newPassword")} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <PasswordChecklist password={pw} />
      <div><button className="btn" type="submit" disabled={f.busy}>{t("acct.changePassword")}</button></div>
    </form>
  );
}

function Email() {
  const { t } = useT(); const f = useForm();
  const [pw, setPw] = useState(""); const [email, setEmail] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); void f.run(async () => { await api("/me/change-email", { method: "POST", body: { password: pw, newEmail: email } }); setPw(""); setEmail(""); toast(t("acct.emailSent")); }); };
  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="h-email">
      <h2 id="h-email">{t("acct.changeEmail")}</h2>
      <ErrorSummary problems={f.problems} />
      <TextField label={t("acct.newEmail")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label={t("acct.currentPassword")} type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
      <div><button className="btn" type="submit" disabled={f.busy}>{t("acct.changeEmail")}</button></div>
    </form>
  );
}

function Mfa() {
  const { t } = useT(); const { me, reload } = useMe(); const f = useForm();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  async function start() {
    await f.run(async () => {
      const r = await api<{ secret: string; otpauthUrl: string }>("/auth/mfa/setup", { method: "POST", body: {} });
      setSetup({ ...r, qr: await QRCode.toDataURL(r.otpauthUrl, { margin: 1, width: 192 }) });
    });
  }
  const confirm = (e: FormEvent) => { e.preventDefault(); void f.run(async () => { await api("/auth/mfa/verify", { method: "POST", body: { code } }); setSetup(null); setCode(""); await reload(); toast(t("acct.mfaEnabled")); }, () => "mfa-code"); };
  return (
    <section className="card stack" aria-labelledby="h-mfa">
      <div className="row between"><h2 id="h-mfa" style={{ margin: 0 }}>{t("acct.mfa")}</h2><Badge tone={me.mfaEnabled ? "good" : "warn"}>{me.mfaEnabled ? t("acct.mfaOn") : t("acct.mfaOff")}</Badge></div>
      <ErrorSummary problems={f.problems} />
      {!me.mfaEnabled && !setup ? <div><button type="button" className="btn" onClick={start} disabled={f.busy}>{t("acct.mfaStart")}</button></div> : null}
      {setup ? (
        <form className="stack" onSubmit={confirm} noValidate>
          <p>{t("acct.mfaScan")}</p>
          <img src={setup.qr} width={192} height={192} alt="" style={{ background: "#fff", padding: 8, borderRadius: 12, border: "1px solid var(--line)" }} />
          <p style={{ margin: 0 }}><span className="muted">{t("acct.mfaKey")}: </span><code style={{ wordBreak: "break-all" }}>{setup.secret}</code></p>
          <TextField id="mfa-code" label={t("auth.mfaCode")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <div><button className="btn" type="submit" disabled={f.busy || code.length !== 6}>{t("acct.mfaConfirm")}</button></div>
        </form>
      ) : null}
    </section>
  );
}

interface Dev { id: string; model: string | null; osVersion: string | null; appVersion: string | null; lastSeenAt: string }
function Devices() {
  const { t, locale } = useT(); const errText = useErrorText(); const router = useRouter();
  const [devs, setDevs] = useState<Dev[] | null>(null); const [all, setAll] = useState(false);
  const load = () => api<Dev[]>("/me/devices").then(setDevs).catch(() => setDevs([]));
  useEffect(() => { void load(); }, []);
  async function revoke(id: string) { try { await api(`/me/devices/${id}`, { method: "DELETE" }); toast(t("users.done")); await load(); } catch (e) { toast(errText(e), true); } }
  async function logoutAll() { try { await api("/auth/logout-all", { method: "POST", body: {} }); setCsrf(undefined); router.replace("/login"); } catch (e) { toast(errText(e), true); } }
  return (
    <section className="card stack" aria-labelledby="h-dev">
      <h2 id="h-dev">{t("acct.devices")}</h2>
      {devs && !devs.length ? <p className="muted">{t("acct.noDevices")}</p> : null}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {devs?.map((d) => <li key={d.id} className="row between"><span>{d.model ?? "iPhone"} · iOS {d.osVersion ?? "?"} · <span className="muted">{fmtDate(d.lastSeenAt, locale)}</span></span><button type="button" className="btn secondary sm" onClick={() => revoke(d.id)}>{t("acct.revoke")}</button></li>)}
      </ul>
      <div><button type="button" className="btn secondary" onClick={() => setAll(true)}>{t("auth.logoutAll")}</button></div>
      <Confirm open={all} title={t("auth.logoutAll")} body={t("auth.logoutAll")} confirmLabel={t("common.confirm")} onConfirm={logoutAll} onClose={() => setAll(false)} />
    </section>
  );
}

function Danger() {
  const { t } = useT(); const router = useRouter(); const f = useForm();
  const [pw, setPw] = useState(""); const [ask, setAsk] = useState(false);
  const del = () => f.run(async () => { await api("/me", { method: "DELETE", body: { password: pw } }); setCsrf(undefined); router.replace("/"); }, () => "del-pw").finally(() => setAsk(false));
  return (
    <section className="card stack" aria-labelledby="h-del" style={{ borderColor: "var(--danger)" }}>
      <h2 id="h-del">{t("acct.danger")}</h2>
      <ErrorSummary problems={f.problems} />
      <p>{t("acct.deleteBody")}</p>
      <TextField id="del-pw" label={t("acct.deleteConfirmPw")} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <div><button type="button" className="btn danger" disabled={!pw} onClick={() => setAsk(true)}>{t("acct.deleteTitle")}</button></div>
      <Confirm open={ask} title={t("acct.deleteTitle")} body={t("acct.deleteBody")} confirmLabel={t("common.delete")} danger onConfirm={del} onClose={() => setAsk(false)} />
    </section>
  );
}
