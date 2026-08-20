"use client";

import { I18nProvider } from "@lingui/react";
import { i18n, type Messages } from "@lingui/core";
import { useState, type ReactNode } from "react";

import type { Locale } from "~/i18n/locales";

type Props = {
	children: ReactNode;
	locale: Locale;
	messages: Messages;
};

export function LinguiProvider({ children, locale, messages }: Props) {
	const [activeI18n] = useState(() => {
		i18n.load(locale, messages);
		i18n.activate(locale);
		return i18n;
	});

	return <I18nProvider i18n={activeI18n}>{children}</I18nProvider>;
}
