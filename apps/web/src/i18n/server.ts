import "server-only";

import { setupI18n } from "@lingui/core";
import { setI18n } from "@lingui/react/server";

import type { Locale } from "./locales";

export async function setRequestI18n(locale: Locale) {
	const messages = (await import(`~/locales/${locale}/messages.mjs`)).messages;
	const i18n = setupI18n({ locale, messages: { [locale]: messages } });
	i18n.activate(locale);
	setI18n(i18n);
	return i18n;
}
