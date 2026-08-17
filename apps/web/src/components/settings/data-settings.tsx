"use client";

import { useDropzone, type FileError } from "react-dropzone";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useState } from "react";
import { Separator } from "../ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useForm, useSelector } from "@tanstack/react-form";
import z from "zod";
import { Input } from "../ui/input";
import { useDisclosure } from "@mantine/hooks";
import { TrashIcon, XIcon } from "lucide-react";
import { uploadthingToast, useUploadThing } from "../uploadthing";
import type { API } from "~/trpc/server";
import { formatDate } from "date-fns";
import { api } from "~/trpc/react";
import { useEffect } from "react";
import type { EventImportState } from "@startime/db";
import { Spinner } from "../ui/spinner";
import Link from "next/link";
import { useConfirmModal } from "../ui/confirm-modal";
import { cn } from "~/lib/utils";
import { toast } from "sonner";

type ImportItem = NonNullable<NonNullable<API["self"]["listImports"]>["pendingImports"]>[number];

export default function DataManagement({
	imports: initialImports,
	exports: initialExports,
}: {
	imports: API["self"]["listImports"];
	exports: API["self"]["listExports"];
}) {
	const [opened, { toggle }] = useDisclosure();
	const confirmModal = useConfirmModal();

	const [hasPendingImports, setHasPendingImports] = useState(initialImports?.pendingImports?.length > 0);
	const [hasPendingExports, setHasPendingExports] = useState(initialExports?.pending?.length > 0);

	const { data: imports, refetch } = api.self.listImports.useQuery(undefined, {
		initialData: initialImports,
		refetchInterval: hasPendingImports ? 1000 : false,
	});

	const { data: exports, refetch: refetchExports } = api.self.listExports.useQuery(undefined, {
		initialData: initialExports,
		refetchInterval: hasPendingExports ? 1000 : false,
	});

	const { mutate: startExport, isPending } = api.self.triggerExport.useMutation({
		onSuccess: () => {
			refetchExports();
		},
		onError: (error) => {
			toast.error(error.message, {
				id: "trigger-export",
			});
		},
		onMutate: () => {
			toast.dismiss("trigger-export");
		},
	});

	const { mutate: getExportUrl, isPending: isLoadingExportUrl, data: exportUrl } = api.self.getExportUrl.useMutation();

	const form = useForm({
		defaultValues: {
			file: null as File | null,
		},
		validators: {
			onChange: z.object({
				file: z.instanceof(File).refine((value) => {
					if (value.size > 64 * 1024 * 1024) {
						return "File size must be less than 64MB";
					}
					return undefined;
				}),
			}),
		},
	});
	const files = useSelector(form.store, (state) => state.values.file);

	const { startUpload, isUploading } = useUploadThing((routeRegistry) => routeRegistry.startime_import_csv, {
		onClientUploadComplete: (results) => {
			Print.Debug("[FILES]", "onClientUploadComplete", results);
			form.reset();
			uploadthingToast("SUCCESS");

			toggle();
			setTimeout(() => {
				refetch();
			}, 500);
		},
		onUploadError: (error) => {
			Print.Warning("[FILES]", "onUploadError", error);
			uploadthingToast("ERROR", error);
		},
		onUploadProgress(p) {
			uploadthingToast("PENDING", p);
		},
		uploadProgressGranularity: "all",
	});

	const { getRootProps, getInputProps, isDragActive, isDragAccept, open } = useDropzone({
		accept: {
			"text/csv": [".csv"],
		},

		disabled: files !== null,

		validator: (file: File): FileError | null => {
			Print.Debug("file", file);
			if (file.type !== "text/csv") {
				return {
					code: "file-invalid-extension",
					message: "Only .csv files are allowed.",
				};
			}
			return null;
		},

		onDropAccepted: (acceptedFiles) => {
			Print.Debug("acceptedFiles", acceptedFiles);
			form.setFieldValue("file", acceptedFiles[0] as File | null);
		},
		onDropRejected: (rejectedFiles) => {
			Print.Debug("rejectedFiles", rejectedFiles);
		},
		noClick: true,
		maxFiles: 1,
		maxSize: 1024 * 1024 * 64,
	});

	useEffect(() => {
		if (!imports) return setHasPendingImports(false);

		setHasPendingImports(imports.pendingImports.length > 0);
	}, [imports.pendingImports.length]);
	useEffect(() => {
		if (!exports) return setHasPendingExports(false);

		setHasPendingExports(exports.pending.length > 0);
	}, [exports.pending.length]);

	const latestPendingExport = exports.pending.reduce<(typeof exports.pending)[number] | undefined>(
		(latest, exportItem) => (!latest || exportItem.createdAt > latest.createdAt ? exportItem : latest),
		undefined,
	);
	const recentUploadedExport = exports.other.find(
		(exportItem) =>
			exportItem.status === "uploaded" &&
			exportItem.completedAt !== null &&
			Date.now() - exportItem.completedAt.getTime() <= 60 * 1000,
	);

	return (
		<Card>
			<CardContent className="flex w-full flex-col">
				<div className="flex w-full flex-row justify-between space-x-4">
					<div className="flex w-full flex-col flex-nowrap">
						<p>
							Import CSV file from other sources. <br />
							<span className="text-xs text-muted-foreground">
								You can only upload one file at a time and it can't be larger than 64MB.
							</span>
						</p>

						<Dialog open={opened} onOpenChange={toggle}>
							<DialogTrigger asChild>
								<Button className="mt-auto">Import</Button>
							</DialogTrigger>
							<DialogContent {...getRootProps()}>
								{isDragActive && (
									<div className="absolute inset-0 z-10 flex h-full w-full items-center justify-center bg-popover/50">
										{isDragAccept ? (
											<h1 className="m-auto text-2xl">Drop here</h1>
										) : (
											<p className="m-auto text-2xl">File not accepted</p>
										)}
									</div>
								)}
								<DialogTitle>Import CSV</DialogTitle>
								<p>
									Currently we support the CSV format form:
									{/*<br /> - StarTime (this app)*/}
									<br /> -{" "}
									<Link
										className="cursor-pointer text-sidebar-primary hover:underline"
										href="https://codetime.dev"
										target="_blank"
										rel="noopener noreferrer"
									>
										codetime.dev
									</Link>
								</p>
								<form.Subscribe
									selector={(state) => [state.values.file]}
									children={([file]) =>
										file === null ? (
											<DialogDescription
												className="cursor-pointer rounded-sm border p-2 text-center hover:bg-muted"
												onClick={open}
											>
												Drop your CSV file here or click to select one.
												<Input {...getInputProps()} />
											</DialogDescription>
										) : (
											<DialogDescription className="flex items-center justify-center gap-2 rounded-sm border p-2 text-center">
												Selected: {file!.name}
												<Button variant="outline" size="icon-xs" onClick={() => form.reset()}>
													<XIcon className="size-4" />
												</Button>
											</DialogDescription>
										)
									}
								/>

								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => {
											form.reset();
											toggle();
										}}
									>
										Cancel
									</Button>
									<Button
										disabled={form.state.values.file === null || isUploading}
										onClick={() => {
											const file = form.getFieldValue("file");

											if (!file) return;

											startUpload([file]);
										}}
									>
										Import
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>

					<Separator orientation="vertical" />
					<div className="flex w-full flex-col justify-end">
						<p>
							Export your data to a ZIP file. <br />
							<span className="text-xs text-muted-foreground">Export all of your data, associated with your account.</span>
						</p>
						{recentUploadedExport ? (
							<Button
								className="mt-auto"
								variant="outline"
								onMouseEnter={() => {
									if (!isLoadingExportUrl && !exportUrl) getExportUrl();
								}}
								asChild
							>
								<a
									href={exportUrl ?? ""}
									download
									target="_blank"
									rel="noopener noreferrer"
									className={cn(isLoadingExportUrl && "cursor-progress")}
									inert={isLoadingExportUrl}
								>
									Download
								</a>
							</Button>
						) : latestPendingExport ? (
							<p className="mt-auto text-sm text-muted-foreground">Latest: {latestPendingExport.message}</p>
						) : (
							<Button
								className="mt-auto"
								disabled={isPending}
								onClick={async () => {
									const result = await confirmModal({
										content: "Are you sure you want to export your data? This may take a few minutes.",
										closeOnClickOutside: true,
										delay: 2000,
										title: "Export your data",
									});
									if (!result) return;
									startExport();
								}}
							>
								Export
							</Button>
						)}
					</div>
				</div>
				{imports && (
					<div className="">
						<Separator className="my-4" />

						<div className="space-y-2">
							{imports.pendingImports?.length > 0 && (
								<section className="space-y-1.5">
									<h3 className="flex items-center gap-1 text-sm font-medium">
										Pending imports <Spinner className="size-3" />
									</h3>

									<div className="">
										{imports.pendingImports.map((imp) => (
											<ImportRow key={imp.id} imp={imp} />
										))}
									</div>
								</section>
							)}

							{imports.otherImports?.length > 0 && (
								<section className="w-full">
									<h3 className="text-sm font-medium">Past imports</h3>

									<div className="space-y-1.5">
										{imports.otherImports.slice(0, 4).map((imp) => (
											<ImportRow key={imp.id} imp={imp} />
										))}
									</div>

									{imports.totalCount > 4 && (
										<div className="mx-auto w-fit pt-1 text-sm text-muted-foreground">{imports.totalCount - 4} more...</div>
									)}
								</section>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ImportRow({ imp }: { imp: ImportItem }) {
	const status = imp.status.toLowerCase();
	const statusColor = (() => {
		switch (status) {
			case "uploaded":
				return "text-blue-500";
			case "pending":
				return "text-yellow-500";
			case "failed":
				return "text-red-500";
			case "completed":
				return "text-green-500";
			default:
				return "text-muted-foreground";
		}
	})();
	const eventImportLabels: Record<EventImportState, string> = {
		uploaded: "Uploaded",
		pending: "Pending",
		completed: "Completed",
		failed: "Failed",
	};

	return (
		<div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border px-2 py-1">
			<div>
				<p className="flex flex-row items-center gap-x-1 text-sm font-medium">
					{imp.importFile?.fileName ?? imp.fileName ?? "No file name available"}

					<span className="text-xs text-muted-foreground">
						{imp.importFile?.size && `${(imp.importFile.size / 1024 / 1024).toFixed(2)} MB`}
					</span>
					<span
						title={`The file was deleted after the import${imp.status === "completed" ? " was completed" : " failed"}`}
						className="cursor-help text-xs text-muted-foreground"
					>
						(deleted)
					</span>
				</p>
			</div>
			<div className={`text-right text-sm font-semibold ${statusColor}`}>{eventImportLabels[imp.status]}</div>
			<div>
				<p className="text-sm text-muted-foreground">{imp.message ?? "No message available"}</p>
			</div>
			<div className="text-right text-xs text-muted-foreground">
				{imp.updatedAt ? "Updated" : "Created"}: {formatDate(imp.updatedAt ?? imp.createdAt, "dd.MM.yyyy - HH:mm")}
			</div>
		</div>
	);
}
