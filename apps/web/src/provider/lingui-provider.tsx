"use client";

import { setupI18n, type Messages } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useState, type ReactNode } from "react";

import type { Locale } from "~/i18n/locales";

type Props = {
	children: ReactNode;
	locale: Locale;
	messages: Messages;
};

export function LinguiProvider({ children, locale, messages }: Props) {
	const [i18n] = useState(() => {
		const instance = setupI18n({ locale, messages: { [locale]: messages } });
		instance.activate(locale);
		return instance;
	});

	return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
