"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { AuthShell } from "@/components/auth-shell";

function View() {
  const { t } = useT();
  const errText = useErrorText();
  const email = useSearchParams().get("email") ?? "";
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    try { await api("/auth/resend-verification", { method: "POST", body: { email } }); setMsg({ ok: true, text: t("auth.resent") }); }
    catch (e) { setMsg({ ok: false, text: errText(e) }); }
    setBusy(false);
  }
  return (
    <AuthShell title={t("auth.checkEmailTitle")}>
      <p>{t("auth.checkEmailBody", { email })}</p>
      {msg ? <div className={`notice ${msg.ok ? "good" : "bad"}`} role="status">{msg.text}</div> : null}
      <button type="button" className="btn secondary" onClick={resend} disabled={busy || !email}>{t("auth.resend")}</button>
      <Link href="/login">{t("auth.backToLogin")}</Link>
    </AuthShell>
  );
}
export default function Page() { return <Suspense><View /></Suspense>; }
