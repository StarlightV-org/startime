import Link from "next/link";
import { GithubLight } from "./svgs/githubLight";
import { GithubDark } from "./svgs/githubDark";

import { version } from "../../../package.json";
import { Discord } from "./svgs/discord";
import { Trans } from "@lingui/react/macro";

export default function Footer() {
	return (
		<footer className="fixed right-0 bottom-0 left-0 z-0 flex h-8 flex-row items-center justify-center gap-2 border border-t-accent bg-accent p-4 text-sm">
			© {new Date().getFullYear()}{" "}
			<Link href="https://github.com/starlightv-org" className="text-primary hover:underline">
				StarlightV
			</Link>
			-
			<Link
				href="https://github.com/starlightv-org/startime"
				className="flex items-center gap-2 text-primary hover:underline"
			>
				<GithubDark className="inline size-4" />
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
