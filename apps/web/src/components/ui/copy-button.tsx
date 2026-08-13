"use client";

import { CheckIcon, CopyIcon, type LucideIcon } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "~/lib/utils";

export interface CopyButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
	value: string | number | undefined | null;
	label?: string;
	variant?: "default" | "ghost";
	icons?: {
		copy?: LucideIcon;
		check?: LucideIcon;
	};
}

export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
	({ value, label, className, variant = "default", icons, style, ...props }, ref) => {
		const [copied, setCopied] = useState(false);

		const SetCopyIcon = icons?.copy ?? CopyIcon;
		const SetCheckIcon = icons?.check ?? CheckIcon;

		const handleCopy = async () => {
			const textToCopy = value?.toString() ?? "";
			if (!textToCopy.trim()) return;

			try {
				await navigator.clipboard.writeText(textToCopy);
				setCopied(true);
				setTimeout(() => {
					setCopied(false);
				}, 2000);
			} catch (error) {
				Print.Warning("[COPY] Failed to copy", error);
			}
		};

		return (
			<button
				tabIndex={-1}
				ref={ref}
				type="button"
				style={style}
				className={cn(
					!label ? "aspect-square" : null,
					"cursor-pointer",
					"inline-flex items-center justify-center gap-2 rounded-sm p-0.5 text-xs transition-colors",
					"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
					variant === "ghost"
						? "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
						: "border bg-background/50",
					variant === "default" && copied && "border-primary/50 bg-primary/10 text-primary hover:bg-primary/10",
					variant === "ghost" && copied && "bg-primary/10 text-primary hover:bg-primary/20!",
					className,
				)}
				onClick={handleCopy}
				{...props}
			>
				{label && <span className="text-xs text-muted-foreground">{label}</span>}
				<div className="relative flex h-4 w-4 items-center justify-center">
					<SetCopyIcon
						className={cn(
							"absolute text-muted-foreground transition-opacity duration-300",
							copied ? "opacity-0" : "opacity-100",
						)}
						size="sm"
						width={14}
						height={14}
					/>
					<SetCheckIcon
						className={cn("absolute text-primary transition-opacity duration-300", copied ? "opacity-100" : "opacity-0")}
						size="sm"
						width={14}
						height={14}
					/>
				</div>
			</button>
		);
	},
);

CopyButton.displayName = "CopyButton";
