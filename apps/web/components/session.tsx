"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError, setCsrf } from "@/lib/client";

export interface Me {
  id: string; email: string; role: "ADMIN" | "BUSINESS_OWNER" | "USER"; firstName: string; lastName: string;
  phone: string | null; locale: string; mfaEnabled: boolean; emailVerified: boolean; mfaPending: boolean; csrfToken?: string;
}
const Ctx = createContext<{ me: Me; reload: () => Promise<void> } | null>(null);
export const useMe = () => { const c = useContext(Ctx); if (!c) throw new Error("outside SessionGate"); return c; };

/** Loads /me; sends signed-out visitors to /login and 2FA-pending admins to the security page. */
export function SessionGate({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();
  const path = usePathname();

  const reload = useCallback(async () => {
    try {
      const m = await api<Me>("/me");
      setCsrf(m.csrfToken);
      setMe(m);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace(`/login?next=${encodeURIComponent(path)}`);
    }
  }, [router, path]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (me?.mfaPending && path !== "/account") router.replace("/account");
  }, [me, path, router]);

  if (!me) return <div className="auth"><span className="skeleton" style={{ width: 160 }} role="status" aria-label="Loading" /></div>;
  return <Ctx.Provider value={{ me, reload }}>{children}</Ctx.Provider>;
}
