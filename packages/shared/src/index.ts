export const DEFAULT_LOCALE = "pt-MZ";
export const SUPPORTED_LOCALES = ["pt-MZ", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const TIME_ZONE = "Africa/Maputo";
export const CURRENCY = "MZN";
export * from "./password";
export * from "./messages";
