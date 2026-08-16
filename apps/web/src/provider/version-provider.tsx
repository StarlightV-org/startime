"use client";
import { api } from "~/trpc/react";

import pkg from "~/../package.json";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useSession } from "./session-provider";

type VersionInfo = {
	major: number;
	minor: number;
	patch: number;
};

function parseVersion(version: string): VersionInfo | null {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) return null;
	return {
		major: Number.parseInt(match[1]!, 10),
		minor: Number.parseInt(match[2]!, 10),
		patch: Number.parseInt(match[3]!, 10),
	};
}

type VersionDiff = {
	patchDiff: number;
	isMinorUpdate: boolean;
	isMajorUpdate: boolean;
};

type toastProps = {
	patchDiff: number;
	currentVersion: string;
	newVersion: string;
};

function compareVersions(client: VersionInfo, server: VersionInfo): VersionDiff {
	const isMajorUpdate = server.major > client.major;
	const isMinorUpdate = !isMajorUpdate && server.minor > client.minor;

	// Calculate patch difference only if same major and minor
	let patchDiff = 0;
	if (!isMajorUpdate && !isMinorUpdate) {
		patchDiff = server.patch - client.patch;
	}

	return { patchDiff, isMinorUpdate, isMajorUpdate };
}

export function VersionProvider() {
	const [showForceModal, setShowForceModal] = useState(false);
	const { session } = useSession();

	const { data: version, isSuccess } = api.misc.getVersion.useQuery(undefined, {
		refetchInterval: 1000 * 60, // 1 minute
		refetchIntervalInBackground: true,
		refetchOnWindowFocus: true,
		enabled: !!session?.id,
	});

	const [clientVersion, setClientVersion] = useState(pkg.version);
	const serverVersion = version?.version;
	const isUpToDate = clientVersion === serverVersion || !isSuccess;

	useEffect(() => {
		if (serverVersion && clientVersion) {
			if (!isUpToDate) {
				Print.Info("[VERSION]", "Up to date:", isUpToDate, "S:", serverVersion, "C:", clientVersion);
			} else {
				Print.Info("[VERSION]", "Up to date:", isUpToDate);
			}
		}

		if (isUpToDate) {
			toast.dismiss("version-update");
			setShowForceModal(false);
			return;
		}

		if (!isSuccess || !serverVersion) return;

		const clientParsed = parseVersion(clientVersion);
		const serverParsed = parseVersion(serverVersion);

		if (!clientParsed || !serverParsed) {
			// Fallback to simple toast if version parsing fails
			return;
		}

		const { patchDiff, isMinorUpdate, isMajorUpdate } = compareVersions(clientParsed, serverParsed);

		// Force reload modal: more than 3 patches apart OR minor/major update
		if (patchDiff > 10 || isMinorUpdate || isMajorUpdate) {
			toast.dismiss("version-update");
			setShowForceModal(true);
			return;
		}

		// Warning toast: more than 1 version apart (but not requiring force reload)
		if (patchDiff > 4) {
			showErrorToast({ patchDiff, currentVersion: clientVersion, newVersion: serverVersion });
			return;
		}
		// Warning toast: more than 1 version apart (but not requiring force reload)
		if (patchDiff > 2) {
			showWarningToast({ patchDiff, currentVersion: clientVersion, newVersion: serverVersion });
			return;
		}

		// Standard update notification: 2 patch behind
		if (patchDiff >= 1) {
			showInfoToast({ patchDiff, currentVersion: clientVersion, newVersion: serverVersion });
		}
	}, [isUpToDate, isSuccess, serverVersion, clientVersion]);

	function showErrorToast(props: toastProps) {
		toast.error("Eine neue Version ist verfügbar!", {
			action: {
				label: "Jetzt aktualisieren",
				onClick: () => {
					window.location.reload();
				},
			},
			actionButtonStyle: {
				backgroundColor: "var(--secondary) !important",
				cursor: "pointer !important",
				pointerEvents: "auto",
			},
			className: "w-[600px]!",
			dismissible: false,
			duration: Number.POSITIVE_INFINITY,
			id: "version-update",
			position: "top-center",
			description: (
				<>
					Du bist {props.patchDiff} Versionen zurück. Bitte aktualisiere jetzt, um Fehler zu vermeiden.
					<br />
					Deine Version: <span className="text-primary">{props.currentVersion}</span>, Neuste Version:{" "}
					<span className="text-primary">{props.newVersion}</span>
				</>
			),
		});
	}
	function showWarningToast(props: toastProps) {
		toast.warning("Eine neue Version ist verfügbar!", {
			action: {
				label: "Jetzt aktualisieren",

				onClick: () => {
					window.location.reload();
				},
			},
			actionButtonStyle: {
				backgroundColor: "var(--secondary) !important",
				cursor: "pointer !important",
				pointerEvents: "auto",
			},
			className: "w-[500px]!",
			dismissible: false,
			duration: Number.POSITIVE_INFINITY,
			id: "version-update",
			position: "top-center",

			description: (
				<>
					Du bist {props.patchDiff} Versionen zurück. Bitte aktualisiere jetzt, um Fehler zu vermeiden.
					<br />
					Deine Version: <span className="text-primary">{props.currentVersion}</span>, Neuste Version:{" "}
					<span className="text-primary">{props.newVersion}</span>
				</>
			),
		});
	}
	function showInfoToast(props: toastProps) {
		toast.info("Eine neue Version ist verfügbar", {
			action: {
				label: "Jetzt aktualisieren",
				onClick: () => {
					window.location.reload();
				},
			},
			actionButtonStyle: {
				backgroundColor: "var(--secondary) !important",
				cursor: "pointer !important",
				pointerEvents: "auto",
			},
			className: "w-[500px]!",
			dismissible: false,
			duration: Number.POSITIVE_INFINITY,
			id: "version-update",
			position: "top-center",
			// description: "Bitte aktualisiere die Seite, um die neueste Version zu verwenden und Fehler zu vermeiden",
			description: (
				<>
					Bitte aktualisiere die Seite, um die neueste Version zu verwenden und Fehler zu vermeiden
					<br />
					Deine Version: <span className="text-primary">{props.currentVersion}</span>, Neuste Version:{" "}
					<span className="text-primary">{props.newVersion}</span>
				</>
			),
		});
	}

	function handleForceReload() {
		window.location.reload();
	}

	return (
		<Dialog open={showForceModal} onOpenChange={() => {}}>
			<DialogContent showCloseButton={false} onPointerDownOutside={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle>Aktualisierung erforderlich</DialogTitle>
					<DialogDescription>
						Eine wichtige neue Version ist verfügbar. Bitte lade die Seite neu, um fortzufahren und Fehler zu vermeiden.
					</DialogDescription>
				</DialogHeader>
				<div className="text-sm text-muted-foreground">
					<p>
						Deine Version: <span className="font-mono">{clientVersion}</span>
					</p>
					<p>
						Neuste Version: <span className="font-mono">{serverVersion}</span>
					</p>
				</div>
				<DialogFooter>
					<Button onClick={handleForceReload}>Seite neu laden</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
