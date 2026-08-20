export const locales = ["en", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "startime_locale";

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && locales.includes(value as Locale);
}

export function resolveLocale(...candidates: unknown[]): Locale {
	Print.Debug("candidates", candidates);
	return candidates.find(isLocale) ?? defaultLocale;
}

export function fromHeader(header: Headers): Locale {
	const lang = header.get("Accept-Language");
	Print.Debug(lang);
	return lang?.split("-")[0] as Locale;
}
