import Link from "next/link";
import {
	ArrowRight,
	CalendarDays,
	Check,
	Clock3,
	HatGlassesIcon,
	ImportIcon,
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
import { cn } from "~/lib/utils";
import { CursorLight } from "~/components/ui/svgs/cursorLight";
import type { Route } from "next";

const features = [
	{
		icon: HatGlassesIcon,
		title: "Respect your privacy",
		description: "Only stores the necessary data. Filenames are hashed.",
	},
	{
		icon: Users,
		title: "Join or create an organization",
		description: "Track your time together with your friends / team",
	},
	{
		icon: ImportIcon,
		title: "Import your data",
		description: "Import your existing time tracking data from other tools. Like, codetime.dev",
	},
];

const extensions: Array<{
	editor: string;
	description: string;
	url: string | undefined;
	icon: React.ReactNode;
	state?: "not-started" | "started" | "completed";
}> = [
	{
		editor: "Zed",
		description: "Fast and AI-powered code editor that makes you more productive.",
		url: undefined,
		icon: <ZedLogo className="size-10 text-white" />,
		state: "completed",
	},
	{
		editor: "VS Code",
		description: "The popular code editor",
		url: undefined,
		icon: <Vscode className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Cursor",
		description: "Fork of VS Code with AI-powered features",
		url: undefined,
		icon: <CursorLight className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Visual Studio",
		description: "Built-in full-stack support ready for your next endeavor",
		url: undefined,
		icon: <VisualStudio className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Vim",
		description: "The popular code editor",
		url: undefined,
		icon: <Vim className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Neovim",
		description: "The popular code editor",
		url: undefined,
		icon: <Neovim className="size-10" />,
		state: "not-started",
	},
	{
		editor: "Obsidian",
		description: "Note-taking and knowledge management app",
		url: undefined,
		icon: <Obsidian className="size-10" />,
		state: "started",
	},
	{
		editor: "More?",
		description: "Missing an editor extension? Create a request on GitHub",
		url: "https://github.com/StarlightV-org/startime",
		icon: <PlusIcon className="size-10" />,
	},
];

const stateLabels: Record<string, { label: string; description: string; className: string }> = {
	"not-started": {
		label: "Not started",
		description: "This editor extension is planned but not yet in development.",
		className: "border-yellow-500/30 bg-yellow-500/15 text-yellow-400/90",
	},
	started: {
		label: "Started",
		description: "Development has begun for this editor extension.",
		className: "border-blue-500/30 bg-blue-500/15 text-blue-400/90",
	},
	completed: {
		label: "Completed",
		description: "This editor extension is available to use.",
		className: "border-green-500/30 bg-green-500/15 text-green-400/90",
	},
};

const benefits = ["Easy setup", "Free", "Open source"];

export default async function Home() {
	const { user } = await getAuth();

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
									Sign in
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								</Link>
							</Button>
						) : (
							<Button asChild className="hidden sm:inline-flex">
								<Link href="/dash">
									Open dashboard
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
								Track how you spend your time
							</h1>
							<p className="max-w-xl text-lg leading-8 text-muted-foreground">
								Visualize your coding time. <br /> We are currently in closed beta. Singups will be open soon.
							</p>
						</div>
						<nav className="flex items-center gap-2" aria-label="Primary navigation">
							{!user ? (
								<Button asChild variant="ghost">
									<Link href="/auth/signin">
										Sign in
										<ArrowRight data-icon="inline-end" aria-hidden="true" />
									</Link>
								</Button>
							) : (
								<div className="flex items-center gap-2 rounded-lg bg-accent">
									<Button asChild className="hidden sm:inline-flex">
										<Link href="/dash">
											Open dashboard
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
								<li key={benefit} className="flex items-center gap-2">
									<Check className="text-primary" aria-hidden="true" />
									{benefit}
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
						<p className="text-sm font-medium text-primary">Designed for momentum</p>
						<h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
							Less friction. More of what moves you forward.
						</h2>
					</div>
					<div className="grid gap-5 md:grid-cols-3">
						{features.map(({ icon: Icon, title, description }) => (
							<Card key={title}>
								<CardHeader className="gap-3">
									<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<Icon aria-hidden="true" />
									</span>
									<CardTitle>{title}</CardTitle>
									<CardDescription className="px-0">{description}</CardDescription>
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
						<p className="text-sm font-medium text-primary">Editor Extensions</p>
						<h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
							An extension ecosystem for all the editors you love.
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
																{stateLabels[state]?.label}
															</Badge>
														</TooltipTrigger>
														<TooltipContent>{stateLabels[state]?.description}</TooltipContent>
													</Tooltip>
												)}
											</span>
											<CardTitle>{editor}</CardTitle>
											<CardDescription className="p-0">{description}</CardDescription>
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
																{stateLabels[state]?.label}
															</Badge>
														</TooltipTrigger>
														<TooltipContent>{stateLabels[state]?.description}</TooltipContent>
													</Tooltip>
												)}
											</span>
											<CardTitle>{editor}</CardTitle>
											<CardDescription className="p-0">{description}</CardDescription>
										</CardHeader>
									</Card>
								</Link>
							);
						})}
					</div>
				</div>
			</section>

			<section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center lg:px-8">
				<p className="text-sm font-medium text-primary">Start where you are</p>
				<h2 className="max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
					Make room for the work and life that matter.
				</h2>
				<p className="max-w-xl text-muted-foreground">Your next focused day is closer than you think.</p>
				<Button asChild size="lg">
					<Link href="/dash">
						Go to dashboard
						<ArrowRight data-icon="inline-end" aria-hidden="true" />
					</Link>
				</Button>
			</section>
		</main>
	);
}
