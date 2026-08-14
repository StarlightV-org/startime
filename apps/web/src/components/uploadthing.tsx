import { generateReactHelpers } from "@uploadthing/react";
import { toast } from "sonner";
import type { UploadThingError } from "uploadthing/server";

import type { OurFileRouter } from "~/app/api/uploadthing/core";
import { Progress } from "./ui/progress";

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

export function parseUploadThingError(error: UploadThingError): string {
	const { message, errorCode, cause } = uploadThingErrorCause(error);
	if (message && !errorCode) {
		return message;
	}
	switch (errorCode) {
		case "FileCountMismatch":
			return "You cant upload so many files at once.";
		case "FileSizeMismatch":
			return "The file is too large.";
		case "InvalidFileType":
			return "This file type is not allowed.";
		case "MAX_FILE_SIZE_REACHED":
			return "The team has reached the maximum file size.";
		case "NOT_AUTHORIZED":
			return "You do not have permission to upload files in this team.";
		default: {
			if (cause && message) {
				return cause;
			}
			return "Ein unbekannter Fehler ist aufgetreten";
		}
	}
}

export function uploadthingToast(type: "PENDING", percentage: number): void;
export function uploadthingToast(type: "ERROR", error: UploadThingError | { message: string }): void;
export function uploadthingToast(type: "SUCCESS"): void;
export function uploadthingToast(type: "DISMISS"): void;
export function uploadthingToast(
	type: "PENDING" | "SUCCESS" | "ERROR" | "DISMISS",
	second?: number | (UploadThingError | { message: string }),
): void {
	switch (type) {
		case "PENDING": {
			const percentage = second as number;
			toast.loading(`Uploading ${percentage.toFixed(2)}%`, {
				id: "upload-progress",
				description: <Progress value={percentage} className="w-full" />,
			});
			return;
		}
		case "ERROR": {
			const error = second as UploadThingError;
			toast.error(`Upload failed: ${parseUploadThingError(error)}`, {
				id: "upload-progress",
				description: undefined,
			});
			return;
		}
		case "SUCCESS":
			toast.success("Dateien erfolgreich hochgeladen", {
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
