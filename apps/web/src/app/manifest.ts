import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Star Time",
		short_name: "StarTime",
		description: "Track how you spend your time",
		start_url: "/dash",
		scope: "/",
		display: "standalone",
		background_color: "oklch(0.145 0.008 326)",
		theme_color: "oklch(0.145 0.008 326)",
		icons: [
			{
				src: "/favicon.svg",
				sizes: "any",
				type: "image/svg+xml",
			},
		],
	};
}
