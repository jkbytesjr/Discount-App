"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { ErrorSummary, TextField, type Problem } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function Page() {
  const { t } = useT();
  const errText = useErrorText();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setProblems([]);
    try { await api("/auth/forgot-password", { method: "POST", body: { email } }); setSent(true); }
    catch (err) { setProblems([{ id: "email", message: errText(err) }]); }
    setBusy(false);
  }
  return (
    <AuthShell title={t("auth.forgotTitle")} subtitle={t("auth.forgotBody")}>
      {sent ? <div className="notice good" role="status">{t("auth.forgotSent")}</div> : (
        <form onSubmit={submit} className="stack" noValidate>
          <ErrorSummary problems={problems} />
          <TextField id="email" label={t("auth.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" type="submit" disabled={busy}>{t("auth.sendLink")}</button>
        </form>
      )}
      <Link href="/login">{t("auth.backToLogin")}</Link>
    </AuthShell>
  );
}
