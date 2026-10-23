import type { Locale } from "@moz/shared";
import type { Mail } from "./mailer";

type Kind = "verify" | "reset" | "locked" | "newDevice" | "emailChange" | "businessApproved" | "businessRejected" | "businessSuspended";

const T: Record<Kind, Record<Locale, { subject: string; intro: string; cta?: string }>> = {
  verify: {
    "pt-MZ": { subject: "Confirme o seu email", intro: "Bem-vindo ao Moz Discounts. Confirme o seu email para activar a conta (válido 24 horas).", cta: "Confirmar email" },
    en: { subject: "Confirm your email", intro: "Welcome to Moz Discounts. Confirm your email to activate your account (valid 24 hours).", cta: "Confirm email" },
  },
  reset: {
    "pt-MZ": { subject: "Repor a palavra-passe", intro: "Pediu para repor a palavra-passe (válido 1 hora). Se não foi você, ignore este email.", cta: "Repor palavra-passe" },
    en: { subject: "Reset your password", intro: "You asked to reset your password (valid 1 hour). If this was not you, ignore this email.", cta: "Reset password" },
  },
  locked: {
    "pt-MZ": { subject: "Conta bloqueada temporariamente", intro: "Houve demasiadas tentativas de início de sessão falhadas. A conta foi bloqueada temporariamente." },
    en: { subject: "Account temporarily locked", intro: "There were too many failed sign-in attempts. Your account is temporarily locked." },
  },
  newDevice: {
    "pt-MZ": { subject: "Novo dispositivo na sua conta", intro: "Iniciou-se sessão num novo dispositivo. Se não foi você, altere a palavra-passe." },
    en: { subject: "New device signed in", intro: "A new device signed in to your account. If this was not you, change your password." },
  },
  emailChange: {
    "pt-MZ": { subject: "Confirme o novo email", intro: "Confirme o novo endereço de email (válido 24 horas).", cta: "Confirmar novo email" },
    en: { subject: "Confirm your new email", intro: "Confirm your new email address (valid 24 hours).", cta: "Confirm new email" },
  },
  businessApproved: {
    "pt-MZ": { subject: "O seu negócio foi aprovado", intro: "O perfil do seu negócio foi aprovado. Já pode publicar ofertas.", cta: "Abrir o portal" },
    en: { subject: "Your business was approved", intro: "Your business profile was approved. You can now publish offers.", cta: "Open the portal" },
  },
  businessRejected: {
    "pt-MZ": { subject: "O seu negócio não foi aprovado", intro: "O perfil do seu negócio não foi aprovado. Pode corrigi-lo e submeter novamente." },
    en: { subject: "Your business was not approved", intro: "Your business profile was not approved. You can fix it and submit again." },
  },
  businessSuspended: {
    "pt-MZ": { subject: "O seu negócio foi suspenso", intro: "O perfil do seu negócio foi suspenso e as suas ofertas foram pausadas." },
    en: { subject: "Your business was suspended", intro: "Your business profile was suspended and its offers were paused." },
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildMail(kind: Kind, locale: Locale, to: string, link?: string, reason?: string): Mail {
  const t = T[kind][locale] ?? T[kind]["pt-MZ"];
  const button = link && t.cta ? `<p><a href="${link}">${t.cta}</a></p><p>${link}</p>` : "";
  const why = reason ? `<p>${locale === "en" ? "Reason" : "Motivo"}: ${esc(reason)}</p>` : "";
  return { to, subject: t.subject, html: `<p>${t.intro}</p>${why}${button}` };
}
