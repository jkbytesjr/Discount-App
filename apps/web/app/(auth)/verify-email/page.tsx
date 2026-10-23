"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useT } from "@/components/i18n";
import { AuthShell } from "@/components/auth-shell";

function View() {
  const { t } = useT();
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return; once.current = true; // tokens are single use: never call twice
    if (!token) return setState("fail");
    api("/auth/verify-email", { method: "POST", body: { token } }).then(() => setState("ok"), () => setState("fail"));
  }, [token]);
  return (
    <AuthShell title={t("auth.checkEmailTitle")}>
      <div role="status" className={`notice ${state === "ok" ? "good" : state === "fail" ? "bad" : ""}`}>
        {state === "loading" ? t("auth.verifying") : state === "ok" ? t("auth.verified") : t("auth.verifyFailed")}
      </div>
      <Link className={state === "ok" ? "btn" : "btn secondary"} href={state === "fail" ? "/check-email" : "/login"}>{state === "fail" ? t("auth.resend") : t("auth.login")}</Link>
    </AuthShell>
  );
}
export default function Page() { return <Suspense><View /></Suspense>; }
