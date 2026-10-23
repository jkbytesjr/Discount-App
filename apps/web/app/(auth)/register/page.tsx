"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkPassword } from "@moz/shared";
import { api, ApiError } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { ErrorSummary, PasswordChecklist, TextField, type Problem } from "@/components/ui";
import { AuthShell } from "@/components/auth-shell";

export default function Page() {
  const { t, locale } = useT();
  const errText = useErrorText();
  const router = useRouter();
  const [f, setF] = useState({ accountType: "user", firstName: "", lastName: "", email: "", password: "", confirmPassword: "", acceptTerms: false });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const p: Problem[] = [];
    if (!f.firstName.trim()) p.push({ id: "firstName", message: `${t("auth.firstName")}: ${t("common.required")}` });
    if (!f.lastName.trim()) p.push({ id: "lastName", message: `${t("auth.lastName")}: ${t("common.required")}` });
    if (!f.email.includes("@")) p.push({ id: "email", message: `${t("auth.email")}: ${t("common.required")}` });
    if (checkPassword(f.password, f.email).length) p.push({ id: "password", message: t("err.PASSWORD_WEAK") });
    if (f.password !== f.confirmPassword) p.push({ id: "confirm", message: t("err.PASSWORD_MISMATCH") });
    if (!f.acceptTerms) p.push({ id: "terms", message: t("auth.terms") });
    setProblems(p);
    if (p.length) return;
    setBusy(true);
    try {
      await api("/auth/register", { method: "POST", body: { ...f, locale } });
      router.replace(`/check-email?email=${encodeURIComponent(f.email)}`);
    } catch (err) {
      setProblems([{ message: err instanceof ApiError && err.code === "VALIDATION_FAILED" ? t("err.VALIDATION_FAILED") : errText(err) }]);
      setBusy(false);
    }
  }
  const has = (id: string) => problems.find((x) => x.id === id)?.message;

  return (
    <AuthShell title={t("auth.registerTitle")}>
      <form onSubmit={submit} className="stack" noValidate>
        <ErrorSummary problems={problems} />
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="legend">{t("auth.accountType")}</legend>
          <div className="radio-cards" style={{ marginTop: 6 }}>
            {(["user", "business"] as const).map((v) => (
              <label key={v} className="radio-card"><input type="radio" name="type" value={v} checked={f.accountType === v} onChange={set("accountType")} />{t(v === "user" ? "auth.typeUser" : "auth.typeBusiness")}</label>
            ))}
          </div>
        </fieldset>
        <div className="grid2">
          <TextField id="firstName" label={t("auth.firstName")} autoComplete="given-name" value={f.firstName} onChange={set("firstName")} error={has("firstName")} />
          <TextField id="lastName" label={t("auth.lastName")} autoComplete="family-name" value={f.lastName} onChange={set("lastName")} error={has("lastName")} />
        </div>
        <TextField id="email" label={t("auth.email")} type="email" autoComplete="email" value={f.email} onChange={set("email")} error={has("email")} />
        <TextField id="password" label={t("auth.password")} type="password" autoComplete="new-password" value={f.password} onChange={set("password")} error={has("password")} />
        <PasswordChecklist password={f.password} email={f.email} />
        <TextField id="confirm" label={t("auth.confirmPassword")} type="password" autoComplete="new-password" value={f.confirmPassword} onChange={set("confirmPassword")} error={has("confirm")} />
        <label className="check"><input id="terms" type="checkbox" checked={f.acceptTerms} onChange={set("acceptTerms")} aria-invalid={has("terms") ? true : undefined} />{t("auth.terms")}</label>
        <button className="btn" type="submit" disabled={busy}>{t("auth.register")}</button>
      </form>
      <p className="muted" style={{ margin: 0 }}>{t("auth.haveAccount")} <Link href="/login">{t("auth.login")}</Link></p>
    </AuthShell>
  );
}
