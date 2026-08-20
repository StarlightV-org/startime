import "server-only";

import { setupI18n } from "@lingui/core";

import type { Locale } from "./locales";

export async function getI18nInstance(locale: Locale) {
	const messages = (await import(`~/locales/${locale}/messages.mjs`)).messages;
	const i18n = setupI18n({ locale, messages: { [locale]: messages } });
	i18n.activate(locale);
	return i18n;
}



