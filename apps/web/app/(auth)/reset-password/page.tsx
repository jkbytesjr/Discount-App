"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { checkPassword } from "@moz/shared";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { ErrorSummary, PasswordChecklist, TextField, type Problem } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

function View() {
  const { t } = useT();
  const errText = useErrorText();
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const p: Problem[] = [];
    if (checkPassword(pw).length) p.push({ id: "pw", message: t("err.PASSWORD_WEAK") });
    if (pw !== pw2) p.push({ id: "pw2", message: t("err.PASSWORD_MISMATCH") });
    setProblems(p); if (p.length) return;
    setBusy(true);
    try { await api("/auth/reset-password", { method: "POST", body: { token, password: pw } }); setDone(true); }
    catch (err) { setProblems([{ message: errText(err) }]); }
    setBusy(false);
  }
  const has = (id: string) => problems.find((x) => x.id === id)?.message;
  return (
    <AuthShell title={t("auth.resetTitle")}>
      {done ? <div className="notice good" role="status">{t("auth.resetDone")}</div> : (
        <form onSubmit={submit} className="stack" noValidate>
          <ErrorSummary problems={problems} />
          <TextField id="pw" label={t("auth.newPassword")} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={has("pw")} />
          <PasswordChecklist password={pw} />
          <TextField id="pw2" label={t("auth.confirmPassword")} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={has("pw2")} />
          <button className="btn" type="submit" disabled={busy || !token}>{t("auth.resetTitle")}</button>
        </form>
      )}
      <Link href="/login">{t("auth.backToLogin")}</Link>
    </AuthShell>
  );
}
export default function Page() { return <Suspense><View /></Suspense>; }
