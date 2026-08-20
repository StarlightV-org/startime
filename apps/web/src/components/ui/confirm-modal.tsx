"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CopyButton } from "~/components/ui/copy-button";
import { Trans, useLingui } from "@lingui/react/macro";

export interface ConfirmModalOptionsBase {
	/** Content to display in the modal (ReactNode) */
	content: ReactNode;
	/** If set, user must type this exactly; if omitted, confirm is allowed without input (still respects delay). */
	requiredValue?: string;
	/** Modal title (optional) */
	title?: string;
	/** Label for the confirm button (optional) */
	confirmLabel?: string;
	/** Use destructive variant for confirm button (optional, default: true) */
	variant?: "default" | "destructive";
	/** Delay in ms before input/submit is allowed (optional) */
	delay?: number;
	/** When true, clicking the overlay dismisses like cancel. Default: `false`. */
	closeOnClickOutside?: boolean;
}

export interface ConfirmModalOptions extends ConfirmModalOptionsBase {
	/** When true, rejects on cancel. When false (default), returns false on cancel. */
	throw?: boolean;
}

interface ConfirmModalState extends ConfirmModalOptionsBase {
	throw: boolean;
	resolve: (value?: boolean) => void;
	reject: (reason?: unknown) => void;
}

type ConfirmModalFn = {
	(options: ConfirmModalOptionsBase & { throw?: false }): Promise<boolean>;
	(options: ConfirmModalOptionsBase & { throw: true }): Promise<void>;
};

const ConfirmModalContext = createContext<ConfirmModalFn | null>(null);

export function useConfirmModal() {
	const ctx = useContext(ConfirmModalContext);
	if (!ctx) {
		throw new Error("useConfirmModal must be used within ConfirmModalProvider");
	}
	return ctx;
}

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
	const { t } = useLingui();
	const [state, setState] = useState<ConfirmModalState | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const confirmAction = useCallback((options: ConfirmModalOptions) => {
		const shouldThrow = options.throw ?? false;
		const { throw: _throw, ...baseOptions } = options;
		return new Promise<boolean | undefined>((resolve, reject) => {
			setState({
				...baseOptions,
				closeOnClickOutside: baseOptions.closeOnClickOutside ?? false,
				throw: shouldThrow,
				resolve: (value) => resolve(value),
				reject,
			});
			setInputValue("");
			const delayMs = baseOptions.delay ?? 0;
			setRemainingSeconds(delayMs > 0 ? Math.ceil(delayMs / 1000) : 0);
			if (baseOptions.requiredValue != null) {
				requestAnimationFrame(() => {
					setTimeout(() => inputRef.current?.focus(), 100);
				});
			}
		});
	}, []) as ConfirmModalFn;

	useEffect(() => {
		if (!state?.delay || state.delay <= 0) return;
		const timeoutId = setTimeout(() => setRemainingSeconds(0), state.delay);
		const intervalId = setInterval(() => {
			setRemainingSeconds((prev) => (prev !== null && prev <= 1 ? 0 : (prev ?? 0) - 1));
		}, 1000);
		return () => {
			clearTimeout(timeoutId);
			clearInterval(intervalId);
		};
	}, [state?.delay]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open && state) {
				state.throw ? state.reject(new Error("Cancelled")) : state.resolve(false);
				setState(null);
				setInputValue("");
			}
		},
		[state],
	);

	const handleConfirm = useCallback(() => {
		if (!state) return;
		if (remainingSeconds !== 0) return;
		if (state.requiredValue != null && inputValue.trim() !== state.requiredValue) return;
		state.throw ? state.resolve() : state.resolve(true);
		setState(null);
		setInputValue("");
	}, [state, inputValue, remainingSeconds]);

	const handleCancel = useCallback(() => {
		if (state) {
			state.throw ? state.reject(new Error("Cancelled")) : state.resolve(false);
			setState(null);
			setInputValue("");
		}
	}, [state]);

	const isMatch = state ? state.requiredValue == null || inputValue.trim() === state.requiredValue : false;
	const canInteract = !state?.delay || state.delay <= 0 || remainingSeconds === 0;

	return (
		<ConfirmModalContext.Provider value={confirmAction}>
			{children}
			{state && (
				<Dialog open={!!state} onOpenChange={handleOpenChange}>
					<DialogContent
						className="gap-1 sm:max-w-125"
						onPointerDownOutside={(e) => {
							if (!state.closeOnClickOutside) e.preventDefault();
						}}
						onFocusOutside={(e) => {
							if (!state.closeOnClickOutside) e.preventDefault();
						}}
					>
						<DialogHeader>
							<DialogTitle>{state.title ?? "Bestätigung erforderlich"}</DialogTitle>
						</DialogHeader>
						<div className="flex flex-col gap-4 py-1">
							<div className="text-sm text-muted-foreground">{state.content}</div>
							{state.requiredValue != null && (
								<div className="space-y-2">
									<Label htmlFor="confirm-value">
										Gib
										<CopyButton value={state.requiredValue} variant="default" className="shrink-0" label={state.requiredValue} />
										ein, um fortzufahren
									</Label>
									<div className="flex gap-2">
										<Input
											ref={inputRef}
											id="confirm-value"
											type="text"
											value={inputValue}
											onChange={(e) => setInputValue(e.target.value)}
											placeholder={state.requiredValue}
											className="font-mono"
											aria-invalid={inputValue.length > 0 && !isMatch}
											autoComplete="off"
											disabled={!canInteract}
										/>
									</div>
								</div>
							)}
						</div>
						<DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-0">
							{state.delay != null && state.delay > 0 ? (
								<div className="min-w-44 shrink-0 text-left text-sm text-muted-foreground">
									{remainingSeconds != null && remainingSeconds > 0 && (
										<span>
											<Trans>
												Wait {remainingSeconds} {remainingSeconds === 1 ? t`second` : t`seconds`}
											</Trans>
										</span>
									)}
								</div>
							) : (
								<div className="min-w-0 flex-1" />
							)}
							<div className="flex shrink-0 gap-2">
								<Button variant="outline" onClick={handleCancel}>
									<Trans>Cancel</Trans>
								</Button>
								<Button variant={state.variant ?? "destructive"} onClick={handleConfirm} disabled={!isMatch || !canInteract}>
									{state.confirmLabel ?? t`Confirm`}
								</Button>
							</div>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</ConfirmModalContext.Provider>
	);
}
