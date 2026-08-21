export const locales = ["en", "de"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "startime_locale";

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && locales.includes(value as Locale);
}

export function resolveLocale(...candidates: unknown[]): Locale {
	return candidates.find(isLocale) ?? defaultLocale;
}

export function fromHeader(header: Headers): Locale {
	const acceptLanguage = header.get("Accept-Language");

	const candidates = acceptLanguage
		?.split(",")
		.map((range, index) => {
			const [language, ...parameters] = range.trim().split(";");
			const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith("q="));
			const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;

			return {
				locale: language?.trim().split("-")[0]?.toLowerCase(),
				quality,
				index,
			};
		})
		.filter(({ locale, quality }) => locale && Number.isFinite(quality) && quality > 0 && quality <= 1)
		.sort((a, b) => b.quality - a.quality || a.index - b.index)
		.map(({ locale }) => locale);

	return resolveLocale(...(candidates ?? []));
}
