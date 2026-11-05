import Link from "next/link";
import { GithubDark } from "./svgs/githubDark";

import { version } from "../../../package.json";
import { Discord } from "./svgs/discord";
import { Trans } from "@lingui/react/macro";

export default function Footer() {
	return (
		<footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t px-4 py-5 text-xs text-muted-foreground [body:has([data-minimal-page])_&]:hidden">
			© {new Date().getFullYear()}{" "}
			<Link href="https://github.com/starlightv-org" className="text-primary hover:underline">
				StarlightV
			</Link>
			-
			<Link
				href="https://github.com/starlightv-org/startime"
				className="flex items-center gap-2 text-primary hover:underline"
			>
				<GithubDark className="inline size-4 [&_path]:fill-current" />
				<Trans>Repository</Trans>
			</Link>
			<Link href="https://starlightv.link/discord" className="flex items-center gap-2 text-primary hover:underline">
				<Discord className="inline size-4" />
				Discord
			</Link>
			-<span className="">v{version}</span>
			{/*<Link href="/licenses" prefetch={false} className="text-primary hover:underline">
				Open Source License
			</Link>
			-
			<Link href="/terms" prefetch={false} className="text-primary hover:underline">
				Terms of Service
			</Link>
			-
			<Link href="/privacy" prefetch={false} className="text-primary hover:underline">
				Privacy Policy
			</Link>*/}
		</footer>
	);
}
