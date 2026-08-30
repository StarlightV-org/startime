"use client";

import { BookOpenIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type MenuState = {
	href: string;
	x: number;
	y: number;
};

function getDocsHref(value: string): string | null {
	const url = new URL(value, "https://docs.starlightv.dev");

	// if (url.origin !== window.location.origin) {
	// 	return null;
	// }

	return url.toString();
}

export function DocsContextMenu() {
	const menuRef = useRef<HTMLDivElement>(null);
	const [menu, setMenu] = useState<MenuState | null>(null);

	useEffect(() => {
		function closeMenu() {
			setMenu(null);
		}

		function handleContextMenu(event: MouseEvent) {
			const target = event.target;

			if (!(target instanceof Element)) {
				return;
			}

			const docsElement = target.closest<HTMLElement>("[data-docs]");
			const docsPath = docsElement?.dataset.docs;

			if (!docsPath) {
				return;
			}

			const href = getDocsHref(docsPath);

			if (!href) {
				return;
			}

			event.preventDefault();
			setMenu({
				href,
				x: Math.min(event.clientX, window.innerWidth - 208),
				y: Math.min(event.clientY, window.innerHeight - 48),
			});
		}

		function handlePointerDown(event: PointerEvent) {
			if (!menuRef.current?.contains(event.target as Node)) {
				closeMenu();
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				closeMenu();
			}
		}

		document.addEventListener("contextmenu", handleContextMenu);
		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("scroll", closeMenu, true);
		document.addEventListener("keydown", handleKeyDown);
		window.addEventListener("resize", closeMenu);
		window.addEventListener("blur", closeMenu);

		return () => {
			document.removeEventListener("contextmenu", handleContextMenu);
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("scroll", closeMenu, true);
			document.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("resize", closeMenu);
			window.removeEventListener("blur", closeMenu);
		};
	}, []);

	if (!menu) {
		return null;
	}

	return (
		<div
			ref={menuRef}
			role="menu"
			className="fixed z-50 min-w-48 cursor-help rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
			style={{ left: Math.max(menu.x, 8), top: Math.max(menu.y, 8) }}
		>
			<a
				href={menu.href}
				rel="noreferrer"
				target="_blank"
				role="menuitem"
				className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
				onClick={() => setMenu(null)}
			>
				<BookOpenIcon />
				Open documentation
			</a>
		</div>
	);
}
