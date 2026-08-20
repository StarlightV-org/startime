"use client";

import { useEffect } from "react";
import { useOpenPanel } from "@openpanel/nextjs";

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

	return (
		<html lang="en">
			<body>
				<h2>{`Something went wrong.`}</h2>
				<button type="button" onClick={reset}>
					{`Try again`}
				</button>
			</body>
		</html>
	);
}
