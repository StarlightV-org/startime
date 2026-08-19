"use client";

import { toast } from "sonner";
import { Button } from "../ui/button";
import { getCenteredPosition, toWindowFeatures } from "../ui/new-window";

const MINIMAL_VIEW_WIDTH = 400;
const MINIMAL_VIEW_HEIGHT = 150;

export default function OpenMinimal() {
	const { left, top } = getCenteredPosition("screen", MINIMAL_VIEW_WIDTH, MINIMAL_VIEW_HEIGHT);
	const url = typeof window !== "undefined" ? `${window.location.origin}/view/minimal` : "/view/minimal";
	return (
		<Button
			variant="outline"

			// className="h-10!"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				const popup = window.open(
					url,
					"reauth",
					toWindowFeatures({ width: MINIMAL_VIEW_WIDTH, height: MINIMAL_VIEW_HEIGHT, left, top }),
				);
				if (!popup) {
					toast.error("Failed to open minimal view", {
						description: "The popup could not be opened. Please check your browser settings.",
					});
				}
			}}
		>
			Minimal View
		</Button>
	);
}
