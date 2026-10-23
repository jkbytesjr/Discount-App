"use client";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { translate, type Locale, type MessageKey } from "@moz/shared";
import { ApiError } from "@/lib/client";

const Ctx = createContext<Locale>("pt-MZ");
export const LocaleProvider = ({ locale, children }: { locale: Locale; children: ReactNode }) => <Ctx.Provider value={locale}>{children}</Ctx.Provider>;

export function useT() {
  const locale = useContext(Ctx);
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  return { t, locale };
}

/** Human message for an API error, in the current language. */
export function useErrorText() {
  const { t } = useT();
  return (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.code === "NETWORK") return t("err.network");
      const key = `err.${e.code}` as MessageKey;
      const msg = translate("en", key) !== key ? t(key) : t("err.generic");
      return msg;
    }
    return t("err.generic");
  };
}

export function setLocaleCookie(l: Locale) {
  document.cookie = `moz_locale=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
