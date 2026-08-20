"use client";

import { useEffect } from "react";
import { useOpenPanel } from "@openpanel/nextjs";
import { useLingui } from "@lingui/react/macro";

export default function GlobalError({
	error,
	reset,
}: Readonly<{
	error: Error & { digest?: string };
	reset: () => void;
}>) {
	const op = useOpenPanel();
	useEffect(() => {
		op.track("client_error", { message: error.message });
	}, [error]);

	const { t } = useLingui();

	return (
		<html lang="en">
			<body>
				<h2>{t`Something went wrong.`}</h2>
				<button type="button" onClick={reset}>
					{t`Try again`}
				</button>
			</body>
		</html>
	);
}
