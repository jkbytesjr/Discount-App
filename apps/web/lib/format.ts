import { TIME_ZONE } from "@moz/shared";

// Dates are stored in UTC and shown in Africa/Maputo.
export const fmtDate = (iso: string | null | undefined, locale: string) =>
  iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso)) : "–";
