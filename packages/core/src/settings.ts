// BR-R6 defaults, editable by admin (assumption 18) plus the demo-mode cooldown (assumption 11).
import { z } from "zod";
import { writeAudit } from "./audit";
import { requireCan } from "./authz";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

export const SETTING_DEFAULTS = {
  alertRadiusM: 150, cooldownHours: 12, dailyCap: 5, nearbyRadiusM: 2000, recentDays: 30, pushDebounceSec: 60, purgeUnverifiedDays: 7, demoMode: false,
} as const;
export type Settings = { -readonly [K in keyof typeof SETTING_DEFAULTS]: (typeof SETTING_DEFAULTS)[K] extends boolean ? boolean : number };

export const settingsSchema = z.strictObject({
  alertRadiusM: z.number().int().min(50).max(1000), cooldownHours: z.number().min(1).max(72), dailyCap: z.number().int().min(1).max(20),
  nearbyRadiusM: z.number().int().min(500).max(10_000), recentDays: z.number().int().min(7).max(90), pushDebounceSec: z.number().int().min(0).max(600),
  purgeUnverifiedDays: z.number().int().min(1).max(30), demoMode: z.boolean(),
}).partial();

export async function getSettings(d: AuthDeps): Promise<Settings> {
  const rows = await d.db.systemSetting.findMany({ where: { key: { startsWith: "cfg." } } });
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) { const k = r.key.slice(4); if (k in SETTING_DEFAULTS) out[k] = r.value; }
  return out as Settings;
}

/** What devices need: demo mode shortens the cooldown to 5 minutes so demos can be repeated. */
export async function publicSettings(d: AuthDeps) {
  const s = await getSettings(d);
  return { defaultRadiusM: s.alertRadiusM, cooldownSeconds: s.demoMode ? 300 : Math.round(s.cooldownHours * 3600), dailyCap: s.dailyCap, nearbyRadiusM: s.nearbyRadiusM, recentDays: s.recentDays, demoMode: s.demoMode };
}

export async function updateSettings(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const patch = settingsSchema.parse(raw);
  const before = await getSettings(d);
  for (const [k, v] of Object.entries(patch)) {
    await d.db.systemSetting.upsert({ where: { key: `cfg.${k}` }, create: { key: `cfg.${k}`, value: v as never, updatedBy: ctx.user.id }, update: { value: v as never, updatedBy: ctx.user.id } });
  }
  const after = await getSettings(d);
  await writeAudit(d.db, d.clock, { action: "settings.update", summary: "System settings changed", actor: { userId: ctx.user.id, email: ctx.user.email, role: ctx.user.role }, entityType: "settings", changes: { before, after }, meta });
  return after;
}
