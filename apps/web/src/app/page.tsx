import Link from "next/link";
import {
	ArrowRight,
	CalendarDays,
	Check,
	Clock3,
	CodeXmlIcon,
	ComputerIcon,
	HatGlassesIcon,
	ImportIcon,
	PencilIcon,
	PlusIcon,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ZedLogo } from "~/components/ui/svgs/zedLogo";
import { getAuth } from "~/server/better-auth";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { Vscode } from "~/components/ui/svgs/vscode";
import { VisualStudio } from "~/components/ui/svgs/visualStudio";
import { Vim } from "~/components/ui/svgs/vim";
import { Neovim } from "~/components/ui/svgs/neovim";
import { Obsidian } from "~/components/ui/svgs/obsidian";
import { cn, tryCatch } from "~/lib/utils";
import { CursorLight } from "~/components/ui/svgs/cursorLight";
import type { Route } from "next";
import { api } from "~/trpc/server";
import { TopElement } from "~/components/overview";
import { UnityDark } from "~/components/ui/svgs/unityDark";
import { withRedisCache } from "~/server/redis/cache";
import { msg, t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { setRequestI18n } from "~/i18n/server";
import { fromHeader, resolveLocale } from "~/i18n/locales";
import type { MessageDescriptor } from "@lingui/core";
import { headers } from "next/headers";

const features = [
	{
		icon: HatGlassesIcon,
		title: msg`Respect your privacy`,
		description: msg`Only stores the necessary data. Filenames are hashed.`,
	},
	{
		icon: Users,
		title: msg`Join or create an organization`,
		description: msg`Track your time together with your friends / team`,
	},
	{
		icon: ImportIcon,
		title: msg`Import your data`,
		description: msg`Import your existing time tracking data from other tools. Like, codetime.dev`,
	},
];

const extensions: Array<{
	editor: string;
	description: MessageDescriptor;
	url: string | undefined;
	icon: React.ReactNode;
	state?: "not-started" | "started" | "completed";
}> = [
	{
		editor: "Zed",
		description: msg`Fast and AI-powered code editor that makes you more productive.`,
		url: undefined,
		icon: <ZedLogo className="size-10 text-white" />,
		state: "completed",
	},
	{
		editor: "Obsidian",
		description: msg`Note-taking and knowledge management app`,
		url: undefined,
		icon: <Obsidian className="size-10" />,
		state: "started",
	},
	{
		editor: "Unity",
		description: msg`Game development engine`,
		url: undefined,
		icon: <UnityDark className="size-10" />,
		state: "started",
	},
	{
		editor: "VS Code",
		description: msg`The popular code editor`,
		url: undefined,
		icon: <Vscode className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Cursor",
		description: msg`Fork of VS Code with AI-powered features`,
		url: undefined,
		icon: <CursorLight className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Visual Studio",
		description: msg`Built-in full-stack support ready for your next endeavor`,
		url: undefined,
		icon: <VisualStudio className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Vim",
		description: msg`The popular code editor`,
		url: undefined,
		icon: <Vim className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Neovim",
		description: msg`The popular code editor`,
		url: undefined,
		icon: <Neovim className="size-10" />,
		state: "not-started",
	},

	{
		editor: "More?",
		description: msg`Missing an editor extension? Create a request on GitHub`,
		url: "https://github.com/StarlightV-org/startime",
		icon: <PlusIcon className="size-10" />,
	},
];

const stateLabels: Record<string, { label: MessageDescriptor; description: MessageDescriptor; className: string }> = {
	"not-started": {
		label: msg`Not started`,
		description: msg`This editor extension is planned but not yet in development.`,
		className: "border-yellow-500/30 bg-yellow-500/15 text-yellow-400/90",
	},
	started: {
		label: msg`Started`,
		description: msg`Development has begun for this editor extension.`,
		className: "border-blue-500/30 bg-blue-500/15 text-blue-400/90",
	},
	completed: {
		label: msg`Completed`,
		description: msg`This editor extension is available to use.`,
		className: "border-green-500/30 bg-green-500/15 text-green-400/90",
	},
};

const benefits = [msg`Easy setup`, msg`Free`, msg`Open source`];

export default async function Home() {
	const { user } = await getAuth();
	await setRequestI18n(resolveLocale(user?.accountConfig?.regional.lang, fromHeader(await headers())));
	const [top] = await Promise.all([withRedisCache("api:publicStats:getTop", 60 * 30, () => api.publicStats.getTop())]);

	const { i18n } = useLingui();

	return (
		<main className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border">
				<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
					<div className="flex items-center gap-2">
						<Avatar size="lg">
							<AvatarImage src="/favicon.svg" />
						</Avatar>
						<h1 className="text-3xl text-white">Star Time</h1>
					</div>
					<nav className="flex items-center gap-2" aria-label="Primary navigation">
						{!user ? (
							<Button asChild variant="ghost">
								<Link href="/auth/signin">
									<Trans>Sign in</Trans>
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								</Link>
							</Button>
						) : (
							<Button asChild className="hidden sm:inline-flex">
								<Link href="/dash">
									<Trans>Open dashboard</Trans>
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								</Link>
							</Button>
						)}
					</nav>
				</div>
			</header>

			<section className="relative overflow-hidden">
				<div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
					<div className="flex flex-col items-start gap-6">
						<div className="flex flex-col gap-5">
							<h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
								<Trans>Track how you spend your time</Trans>
							</h1>
							<p className="max-w-xl text-lg leading-8 text-muted-foreground">
								<Trans>
									Visualize your coding time. <br />
								</Trans>
								<Trans>
									<span className="text-sm text-nowrap text-muted-foreground">
										We are currently in closed beta. Singups will be open soon.
									</span>
								</Trans>
							</p>
						</div>
						<nav className="flex items-center gap-2" aria-label="Primary navigation">
							{!user ? (
								<Button asChild variant="ghost">
									<Link href="/auth/signin">
										<Trans>Sign in</Trans>
										<ArrowRight data-icon="inline-end" aria-hidden="true" />
									</Link>
								</Button>
							) : (
								<div className="flex items-center gap-2 rounded-lg bg-accent">
									<Button asChild className="hidden sm:inline-flex">
										<Link href="/dash">
											<Trans>Open dashboard</Trans>
											<ArrowRight data-icon="inline-end" aria-hidden="true" />
										</Link>
									</Button>
									<div className="flex items-center gap-2 pr-2">
										<span className="text-sm">{user.name}</span>
										<Avatar size="sm">
											<AvatarImage src={user.image!} alt={`User Avatar - ${user.name}`} />
											<AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
										</Avatar>
									</div>
								</div>
							)}
						</nav>
						<ul
							className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5"
							aria-label="Startime benefits"
						>
							{benefits.map((benefit) => (
								<li key={i18n._(benefit)} className="flex items-center gap-2">
									<Check className="text-primary" aria-hidden="true" />
									{i18n._(benefit)}
								</li>
							))}
						</ul>
					</div>

					{/*<Card className="border-border bg-card shadow-sm">
						<CardHeader>
							<CardTitle>Today at a glance</CardTitle>
							<CardDescription>A clearer way to see what matters next.</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-4">
								<div className="flex flex-col gap-1">
									<p className="font-medium">Focus block</p>
									<p className="text-sm text-muted-foreground">Shape the product narrative</p>
								</div>
								<span className="rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground">9:00 AM</span>
							</div>
							<div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-4">
								<div className="flex flex-col gap-1">
									<p className="font-medium">Team check-in</p>
									<p className="text-sm text-muted-foreground">Share progress and unblock work</p>
								</div>
								<span className="rounded-md bg-background px-2 py-1 text-xs font-medium text-muted-foreground">11:30 AM</span>
							</div>
							<div className="flex items-center gap-3 rounded-lg border border-border p-4">
								<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<Check aria-hidden="true" />
								</span>
								<div className="flex flex-col gap-1">
									<p className="font-medium">3 priorities complete</p>
									<p className="text-sm text-muted-foreground">You are building a meaningful day.</p>
								</div>
							</div>
						</CardContent>
					</Card>*/}
				</div>
			</section>

			<section className="border-y border-border bg-muted/40">
				<div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 lg:px-8">
					<div className="flex max-w-2xl flex-col gap-3">
						<p className="text-sm font-medium text-primary">
							<Trans>Designed for developers</Trans>
						</p>
						<h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
							<Trans>What we offer</Trans>
						</h2>
					</div>
					<div className="grid gap-5 md:grid-cols-3">
						{features.map(({ icon: Icon, title, description }) => (
							<Card key={i18n._(title)}>
								<CardHeader className="gap-3">
									<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<Icon aria-hidden="true" />
									</span>
									<CardTitle>{i18n._(title)}</CardTitle>
									<CardDescription className="px-0">{i18n._(description)}</CardDescription>
								</CardHeader>
								<CardContent />
							</Card>
						))}
					</div>
				</div>
			</section>
			<section className="border-y border-border">
				<div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 lg:px-8">
					<div className="flex max-w-2xl flex-col gap-3">
						<p className="text-sm font-medium text-primary">
							<Trans>The last 90d</Trans>
						</p>
						<h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
							<Trans>What our users are using</Trans>
						</h2>
					</div>
					<div className="">
						<Card>
							<CardContent>
								<CardHeader className="flex items-center justify-between">
									<CardTitle>Top</CardTitle>
								</CardHeader>
								<CardDescription className="grid grid-cols-3 gap-x-2 divide-x divide-border">
									<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
										<div className="flex items-center gap-2">
											<PencilIcon className="size-4" />
											<h3 className="y text-sm">
												<Trans>Editor</Trans>
											</h3>
										</div>
										{top &&
											Object.entries(top.editor)
												.filter(([, item]) => item.value !== "")
												.map(([key, item]) => <TopElement interactive={false} key={key} element={item} isP1={key === "p1"} />)}
									</div>

									<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
										<div className="flex items-center gap-2">
											<CodeXmlIcon className="size-4" />
											<h3 className="y text-sm">
												<Trans>Language</Trans>
											</h3>
										</div>
										{top &&
											Object.entries(top.language)
												.filter(([, item]) => item.value !== "")
												.map(([key, item]) => (
													<TopElement interactive={false} key={key} element={item} isP1={key === "p1"} filterKey="language" />
												))}
									</div>
									<div className="col-span-1 flex flex-col gap-2 pr-2 first:pl-0">
										<div className="flex items-center gap-2">
											<ComputerIcon className="size-4" />
											<h3 className="y text-sm">
												<Trans>Platform</Trans>
											</h3>
										</div>
										{top &&
											Object.entries(top.platform)
												.filter(([, item]) => item.value !== "")
												.map(([key, item]) => (
													<TopElement interactive={false} key={key} element={item} isP1={key === "p1"} filterKey="platform" />
												))}
									</div>
								</CardDescription>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>
			<section className="border-y border-border bg-muted/40">
				<div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 lg:px-8">
					<div className="flex max-w-2xl flex-col gap-3">
						<p className="text-sm font-medium text-primary">
							<Trans>Editor Extensions</Trans>
						</p>
						<h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
							<Trans>An extension ecosystem for all the editors you love.</Trans>
						</h2>
					</div>
					<div className="grid gap-5 md:grid-cols-3">
						{extensions.map(({ description, editor, icon, url, state }) => {
							if (url === undefined)
								return (
									<Card className="h-full min-h-42" key={editor}>
										<CardHeader className="gap-3">
											<span className="flex size-10 h-fit w-full items-center justify-between rounded-lg text-primary">
												{icon}
												{state !== undefined && (
													<Tooltip>
														<TooltipTrigger asChild>
															<Badge variant="outline" className={cn(stateLabels[state]?.className, "cursor-help")}>
																{i18n._(stateLabels[state]?.label!)}
															</Badge>
														</TooltipTrigger>
														<TooltipContent>{i18n._(stateLabels[state]?.description!)}</TooltipContent>
													</Tooltip>
												)}
											</span>
											<CardTitle>{editor}</CardTitle>
											<CardDescription className="p-0">{i18n._(description!)}</CardDescription>
										</CardHeader>
									</Card>
								);

							return (
								<Link
									key={editor}
									href={(url as Route) ?? ""}
									aria-disabled={url === undefined}
									className={cn(url === undefined && "pointer-events-none")}
									rel="noopener noreferrer"
									target="_blank"
								>
									<Card className="h-full min-h-42">
										<CardHeader className="gap-3">
											<span className="flex size-10 h-fit w-full items-center justify-between rounded-lg text-primary">
												{icon}
												{state !== undefined && (
													<Tooltip>
														<TooltipTrigger asChild>
															<Badge variant="outline" className={stateLabels[state]?.className}>
																{i18n._(stateLabels[state]?.label!)}
															</Badge>
														</TooltipTrigger>
														<TooltipContent>{i18n._(stateLabels[state]?.description!)}</TooltipContent>
													</Tooltip>
												)}
											</span>
											<CardTitle>{editor}</CardTitle>
											<CardDescription className="p-0">{i18n._(description!)}</CardDescription>
										</CardHeader>
									</Card>
								</Link>
							);
						})}
					</div>
				</div>
			</section>
		</main>
	);
}
