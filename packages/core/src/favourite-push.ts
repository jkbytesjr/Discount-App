// BR-R7 / IOS-7: when a favourited discount changes materially, push the people who hearted it.
// POC: sent right after the save (Next `after()`); edits are not merged over a debounce window yet.
import type { AuthDeps } from "./auth/deps";

export type ChangeKey = "status" | "validity" | "schedule" | "terms" | "eligibility" | "premises";
interface Snap { status: string; validFrom: unknown; validTo: unknown; schedule: unknown; terms?: unknown; premises: unknown; eligibility: unknown }

/** Value, validity, schedule, terms, eligibility rows, premises and status count; titles and descriptions (typos) do not. */
export function materialChanges(a: Snap, b: Snap): ChangeKey[] {
  const j = (x: unknown) => JSON.stringify(x);
  const out: ChangeKey[] = [];
  if (a.status !== b.status) out.push("status");
  if (j([a.validFrom, a.validTo]) !== j([b.validFrom, b.validTo])) out.push("validity");
  if (j(a.schedule) !== j(b.schedule)) out.push("schedule");
  if (j(a.terms ?? null) !== j(b.terms ?? null)) out.push("terms");
  if (j(a.eligibility) !== j(b.eligibility)) out.push("eligibility");
  if (j([...(a.premises as string[])].sort()) !== j([...(b.premises as string[])].sort())) out.push("premises");
  return out;
}

const TEXT: Record<"pt" | "en", Record<ChangeKey | "paused" | "ended", string>> = {
  pt: { status: "Estado alterado", validity: "Validade alterada", schedule: "Horário alterado", terms: "Condições alteradas", eligibility: "Valor ou cartões alterados", premises: "Locais alterados", paused: "A oferta foi pausada", ended: "A oferta terminou" },
  en: { status: "Status changed", validity: "Validity changed", schedule: "Schedule changed", terms: "Terms changed", eligibility: "Value or cards changed", premises: "Locations changed", paused: "The offer was paused", ended: "The offer has ended" },
};

export async function notifyFavourites(d: AuthDeps, discountId: string, changes: ChangeKey[], newStatus?: string) {
  if (!d.push || changes.length === 0) return { sent: 0 };
  const favs = await d.db.favorite.findMany({
    where: { discountId, user: { status: "ACTIVE" } },
    include: { user: { include: { alertPref: true, devices: { where: { revokedAt: null, pushToken: { not: null } } } } }, discount: { include: { business: true, premises: { include: { premise: true } } } } },
  });
  let sent = 0;
  for (const f of favs) {
    if (f.user.alertPref && !f.user.alertPref.alertsEnabled) continue;
    const tokens = f.user.devices.map((x) => x.pushToken!).filter(Boolean);
    if (!tokens.length) continue;
    const l = f.user.locale.startsWith("en") ? "en" : "pt";
    const place = f.discount.premises[0]?.premise.name ?? f.discount.business.tradingName;
    const summary = newStatus === "PAUSED" ? TEXT[l].paused : newStatus === "EXPIRED" || newStatus === "ARCHIVED" ? TEXT[l].ended : changes.map((c) => TEXT[l][c]).join(" · ");
    const title = l === "pt" ? `${place}: oferta actualizada` : `${place}: offer updated`; // BR-R8 "favourite updated"
    const res = await d.push.send(tokens, { title, body: summary, data: { type: "favourite_update", discountId } });
    sent += res.sent;
    for (const bad of res.invalid) await d.db.device.updateMany({ where: { pushToken: bad }, data: { pushToken: null } }); // APNs says the token is dead
  }
  return { sent };
}

/** Runs after the response when the host provides `defer`, otherwise inline. A push failure never fails the edit. */
export function schedulePush(d: AuthDeps, fn: () => Promise<unknown>) {
  const safe = () => fn().catch((e) => { console.error("[push] favourite notification failed", e instanceof Error ? e.message : e); });
  if (d.defer) d.defer(safe); else return safe();
}
