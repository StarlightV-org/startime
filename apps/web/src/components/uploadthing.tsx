import { generateReactHelpers } from "@uploadthing/react";
import { toast } from "sonner";
import type { UploadThingError } from "uploadthing/server";

import type { OurFileRouter } from "~/app/api/uploadthing/core";
import { Progress } from "./ui/progress";
import { useLingui } from "@lingui/react/macro";

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>();

function uploadThingErrorCause(error: UploadThingError): {
	message?: string;
	errorCode?: string;
	cause?: string;
} {
	const c = error.cause;
	if (c === null || typeof c !== "object") {
		return {};
	}
	const rec = c as Record<string, unknown>;
	const message = typeof rec.message === "string" ? rec.message : undefined;
	const errorCode = typeof rec.errorCode === "string" ? rec.errorCode : undefined;
	const cause = typeof rec.cause === "string" ? rec.cause : undefined;
	return { message, errorCode, cause };
}

function parseUploadThingError(error: UploadThingError, t: ReturnType<typeof useLingui>["t"]): string {
	const { message, errorCode, cause } = uploadThingErrorCause(error);

	if (message && !errorCode) {
		return message;
	}
	switch (errorCode) {
		case "FileCountMismatch":
			return t`You cant upload so many files at once.`;
		case "FileSizeMismatch":
			return t`The file is too large.`;
		case "InvalidFileType":
			return t`This file type is not allowed.`;

		case "NOT_AUTHORIZED":
			return t`You do not have permission to upload files.`;
		default: {
			if (cause && message) {
				return cause;
			}
			return t`An unknown error occurred.`;
		}
	}
}

export function useUploadthingToast() {
	const { t } = useLingui();

	function uploadthingToast(type: "PENDING", percentage: number): void;
	function uploadthingToast(type: "ERROR", error: UploadThingError | { message: string }): void;
	function uploadthingToast(type: "SUCCESS"): void;
	function uploadthingToast(type: "DISMISS"): void;
	function uploadthingToast(
		type: "PENDING" | "SUCCESS" | "ERROR" | "DISMISS",
		second?: number | (UploadThingError | { message: string }),
	): void {
		switch (type) {
			case "PENDING": {
				const percentage = second as number;
				toast.loading(t`Uploading ${percentage.toFixed(2)}%`, {
					id: "upload-progress",
					description: <Progress value={percentage} className="w-full" />,
				});
				return;
			}
			case "ERROR": {
				const error = second as UploadThingError;
				toast.error(t`Upload failed: ${parseUploadThingError(error, t)}`, {
					id: "upload-progress",
					description: undefined,
				});
				return;
			}
			case "SUCCESS":
				toast.success(t`Files uploaded successfully`, {
					id: "upload-progress",
					description: undefined,
				});
				return;
			case "DISMISS":
				toast.dismiss("upload-progress");
				return;
			default:
				throw new Error(`Invalid uploadthing toast type: ${type}`);
		}
	}

	return uploadthingToast;
}
