"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, setCsrf } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { ErrorSummary, TextField, type Problem } from "@/components/ui";
import { AuthShell, safeNext } from "@/components/auth-shell";
import { Turnstile } from "@/components/turnstile";

function LoginForm() {
  const { t } = useT();
  const errText = useErrorText();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [needMfa, setNeedMfa] = useState(false);
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const [captcha, setCaptcha] = useState<string>();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setProblems([]); setUnverified(false);
    try {
      const r = await api<{ csrfToken?: string }>("/auth/login", { method: "POST", body: { email, password, client: "web", ...(needMfa && mfaCode ? { mfaCode } : {}), ...(captcha ? { captchaToken: captcha } : {}) } });
      setCsrf(r.csrfToken);
      router.replace(safeNext(next));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "MFA_CODE_REQUIRED") setNeedMfa(true);
      if (code === "CAPTCHA_REQUIRED") setNeedCaptcha(true);
      if (code === "EMAIL_NOT_VERIFIED") setUnverified(true);
      if (code === "INVALID_CREDENTIALS") setNeedCaptcha(false);
      setProblems([{ id: code === "MFA_CODE_REQUIRED" || code === "MFA_CODE_INVALID" ? "mfa" : code === "INVALID_CREDENTIALS" ? "password" : "email", message: errText(err) }]);
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.loginTitle")} subtitle={t("auth.loginSub")}>
      <form onSubmit={submit} className="stack" noValidate>
        <ErrorSummary problems={problems} />
        <TextField id="email" label={t("auth.email")} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField id="password" label={t("auth.password")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {needMfa ? <TextField id="mfa" label={t("auth.mfaCode")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))} /> : null}
        {needCaptcha ? <Turnstile onToken={setCaptcha} /> : null}
        <button className="btn" type="submit" disabled={busy}>{t("auth.login")}</button>
        {unverified ? <Link href={`/check-email?email=${encodeURIComponent(email)}`}>{t("auth.resend")}</Link> : null}
      </form>
      <div className="row between">
        <Link href="/forgot-password">{t("auth.forgot")}</Link>
        <span className="muted">{t("auth.noAccount")} <Link href="/register">{t("auth.register")}</Link></span>
      </div>
    </AuthShell>
  );
}
export default function Page() { return <Suspense><LoginForm /></Suspense>; }
