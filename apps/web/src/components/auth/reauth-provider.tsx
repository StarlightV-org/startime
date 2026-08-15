"use client";

import { useEffect, useState } from "react";

import { getReauthModalRequestEvent, resolveReauthModal } from "~/lib/reauth-util";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { ReauthForm } from "./reauth-form";

export function ReauthProvider() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const show = () => setOpen(true);
		window.addEventListener(getReauthModalRequestEvent(), show);
		return () => window.removeEventListener(getReauthModalRequestEvent(), show);
	}, []);

	const handleOpenChange = (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) resolveReauthModal(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<ReauthForm
					onFailure={() => {
						setOpen(false);
						resolveReauthModal(false);
					}}
					onSuccess={() => {
						setOpen(false);
						resolveReauthModal(true);
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}
