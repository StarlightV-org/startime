"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

/**
 * Window features configuration for window.open()
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/open#window_features
 */
export interface WindowFeatures {
	/** Width of the window in pixels */
	width?: number;
	/** Height of the window in pixels */
	height?: number;
	/** Left position of the window */
	left?: number;
	/** Top position of the window */
	top?: number;
	/** Show menubar (default: no) */
	menubar?: boolean;
	/** Show toolbar (default: no) */
	toolbar?: boolean;
	/** Show location/address bar (default: no) */
	location?: boolean;
	/** Show status bar (default: no) */
	status?: boolean;
	/** Allow window resizing (default: yes) */
	resizable?: boolean;
	/** Show scrollbars (default: yes) */
	scrollbars?: boolean;
	/** Allow any additional features */
	[key: string]: number | boolean | undefined;
}

/**
 * Props for the NewWindow component.
 */
export interface NewWindowProps {
	/** Content to render in the new window */
	children?: ReactNode;
	/** URL to open in the new window (if set, children are ignored) */
	url?: string;
	/** Window name (target) - reuses window if same name exists */
	name?: string;
	/** Document title for the new window */
	title?: string;
	/** Window features configuration */
	features?: WindowFeatures;
	/** Callback when popup is blocked by browser */
	onBlock?: () => void;
	/** Callback when window successfully opens */
	onOpen?: (window: Window) => void;
	/** Callback when window is closed/unloaded */
	onUnload?: () => void;
	/** Center window relative to 'parent' window or 'screen' */
	center?: "parent" | "screen";
	/** Copy CSS styles from parent to new window (default: true) */
	copyStyles?: boolean;
	/** Close window when component unmounts (default: true) */
	closeOnUnmount?: boolean;
}

/**
 * Convert features object to window.open() features string format.
 * @example { width: 800, height: 600, menubar: false } => "width=800,height=600,menubar=no"
 */
export function toWindowFeatures(features: WindowFeatures): string {
	return Object.entries(features)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => {
			if (typeof value === "boolean") {
				return `${key}=${value ? "yes" : "no"}`;
			}
			return `${key}=${value}`;
		})
		.join(",");
}

/**
 * Calculate centered position for the new window.
 */
export function getCenteredPosition(
	center: "parent" | "screen",
	width: number,
	height: number,
): { left: number; top: number } {
	if (typeof window === "undefined") return { left: 0, top: 0 };

	if (center === "parent") {
		const topWindow = window.top ?? window;
		return {
			left: Math.round(topWindow.outerWidth / 2 + topWindow.screenX - width / 2),
			top: Math.round(topWindow.outerHeight / 2 + topWindow.screenY - height / 2),
		};
	}

	// center === "screen"
	const screenWidth = window.screen.availWidth;
	const screenHeight = window.screen.availHeight;
	const screenLeft = window.screenLeft ?? window.screenX ?? 0;
	const screenTop = window.screenTop ?? window.screenY ?? 0;

	return {
		left: Math.round(screenWidth / 2 - width / 2 + screenLeft),
		top: Math.round(screenHeight / 2 - height / 2 + screenTop),
	};
}

/**
 * Copy a single stylesheet to target document.
 */
function copyStyleSheet(styleSheet: CSSStyleSheet, target: Document): HTMLStyleElement | HTMLLinkElement | null {
	try {
		if (styleSheet.cssRules) {
			// For <style> elements - create inline style
			const style = target.createElement("style");
			const cssTexts: string[] = [];

			Array.from(styleSheet.cssRules).forEach((rule) => {
				if (rule instanceof CSSKeyframesRule) {
					// Build keyframes manually for better compatibility
					const keyframeTexts = Array.from(rule.cssRules)
						.map((kf) => {
							const keyframe = kf as CSSKeyframeRule;
							return `${keyframe.keyText} { ${keyframe.style.cssText} }`;
						})
						.join(" ");
					cssTexts.push(`@keyframes ${rule.name} { ${keyframeTexts} }`);
				} else if (rule instanceof CSSImportRule || rule instanceof CSSFontFaceRule) {
					// Fix relative URLs in import and font-face rules
					const cssText = rule.cssText.replace(/url\(["']?(?!data:)(?!http)([^"')]+)["']?\)/g, (_, url: string) => {
						if (url.startsWith("/")) {
							return `url("${window.location.origin}${url}")`;
						}
						return `url("${new URL(url, styleSheet.href ?? window.location.href).href}")`;
					});
					cssTexts.push(cssText);
				} else {
					cssTexts.push(rule.cssText);
				}
			});

			style.textContent = cssTexts.join("\n");
			return style;
		} else if (styleSheet.href) {
			// For <link> elements - create link to external stylesheet
			const link = target.createElement("link");
			link.rel = "stylesheet";
			link.href = styleSheet.href;
			return link;
		}
	} catch (err) {
		// CORS error when accessing cross-origin stylesheets
		if (styleSheet.href) {
			const link = target.createElement("link");
			link.rel = "stylesheet";
			link.href = styleSheet.href;
			return link;
		}
	}
	return null;
}

/**
 * Copy all stylesheets from source document to target document.
 * Returns a cleanup function to disconnect the MutationObserver.
 */
function copyStyles(source: Document, target: Document): () => void {
	const fragment = target.createDocumentFragment();
	const copiedHrefs = new Set<string>();

	// Copy classes from html and body elements for theming (e.g., dark mode)
	target.documentElement.className = source.documentElement.className;
	target.body.className = source.body.className;

	// Copy data attributes from html element (some themes use data-theme, etc.)
	Array.from(source.documentElement.attributes).forEach((attr) => {
		if (attr.name.startsWith("data-") || attr.name === "style") {
			target.documentElement.setAttribute(attr.name, attr.value);
		}
	});

	// Copy existing stylesheets
	Array.from(source.styleSheets).forEach((styleSheet) => {
		const el = copyStyleSheet(styleSheet, target);
		if (el) {
			if (styleSheet.href) copiedHrefs.add(styleSheet.href);
			fragment.appendChild(el);
		}
	});

	// Also copy any <style> elements that might not be in styleSheets yet
	source.querySelectorAll("style").forEach((styleEl) => {
		if (styleEl.textContent) {
			const style = target.createElement("style");
			style.textContent = styleEl.textContent;
			if (styleEl.id) style.id = styleEl.id;
			fragment.appendChild(style);
		}
	});

	target.head.appendChild(fragment);

	// Watch for new stylesheets being added (common with Next.js and CSS-in-JS)
	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLStyleElement && node.textContent) {
					const style = target.createElement("style");
					style.textContent = node.textContent;
					if (node.id) style.id = node.id;
					target.head.appendChild(style);
				} else if (node instanceof HTMLLinkElement && node.rel === "stylesheet" && node.href) {
					if (!copiedHrefs.has(node.href)) {
						copiedHrefs.add(node.href);
						const link = target.createElement("link");
						link.rel = "stylesheet";
						link.href = node.href;
						target.head.appendChild(link);
					}
				}
			}
		}

		// Keep html/body classes in sync (for theme changes)
		if (target.documentElement.className !== source.documentElement.className) {
			target.documentElement.className = source.documentElement.className;
		}
		if (target.body.className !== source.body.className) {
			target.body.className = source.body.className;
		}
	});

	observer.observe(source.head, { childList: true, subtree: true });
	observer.observe(source.documentElement, { attributes: true, attributeFilter: ["class"] });
	observer.observe(source.body, { attributes: true, attributeFilter: ["class"] });

	return () => observer.disconnect();
}

const CONTAINER_ID = "new-window-root";

/**
 * NewWindow - Renders React children in a new browser window.
 *
 * Opens a new browser window and renders the children into it using React Portal.
 * Supports copying parent styles, centering, and various window features.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * return (
 *   <>
 *     <button onClick={() => setIsOpen(true)}>Open Window</button>
 *     {isOpen && (
 *       <NewWindow
 *         title="My Window"
 *         features={{ width: 800, height: 600 }}
 *         center="parent"
 *         onUnload={() => setIsOpen(false)}
 *       >
 *         <div>Window Content</div>
 *       </NewWindow>
 *     )}
 *   </>
 * );
 * ```
 */
export function NewWindow({
	children,
	url = "",
	name = "",
	title = "",
	features: featuresProp = {},
	onBlock,
	onOpen,
	onUnload,
	center = "parent",
	copyStyles: shouldCopyStyles = true,
	closeOnUnmount = true,
}: NewWindowProps) {
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const windowRef = useRef<Window | null>(null);
	const releaseRef = useRef(false);
	const initializedRef = useRef(false);
	const styleCleanupRef = useRef<(() => void) | null>(null);
	const closeOnUnmountRef = useRef(closeOnUnmount);
	const mountedRef = useRef(true);

	// Keep ref in sync with prop
	closeOnUnmountRef.current = closeOnUnmount;

	// Stable release function
	const release = useCallback(() => {
		if (releaseRef.current) return;
		releaseRef.current = true;
		onUnload?.();
	}, [onUnload]);

	// Open window on mount
	useEffect(() => {
		mountedRef.current = true;

		let newWindow: Window | null = windowRef.current;
		let pollInterval: ReturnType<typeof setInterval> | null = null;
		let handleBeforeUnload: (() => void) | null = null;

		// Only initialize window once (prevent double-init in React strict mode)
		if (!initializedRef.current) {
			initializedRef.current = true;

			// Build features with centering
			const features: WindowFeatures = { ...featuresProp };
			const width = features.width ?? 600;
			const height = features.height ?? 640;

			if (center) {
				const { left, top } = getCenteredPosition(center, width, height);
				features.left = left;
				features.top = top;
			}

			// Ensure width/height are set
			features.width = width;
			features.height = height;

			// Open the window
			newWindow = window.open(url, name, toWindowFeatures(features));

			if (!newWindow) {
				toast.error("Das Fenster konnte nicht geöffnet werden!", {
					description: "Erlaube dem Control Panel das Öffnen von Popup-Fenstern.",
					duration: 10000,
				});

				onBlock?.();
				return;
			}

			windowRef.current = newWindow;

			// Set document title
			if (title) {
				newWindow.document.title = title;
			}

			// Create or get container element
			const existingContainer = newWindow.document.getElementById(CONTAINER_ID) as HTMLDivElement | null;
			const isExistingWindow = existingContainer !== null;

			let containerEl: HTMLDivElement;
			if (existingContainer) {
				// Window was reused (same name) - clear previous content
				existingContainer.innerHTML = "";
				containerEl = existingContainer;
			} else {
				// New window - create container
				containerEl = newWindow.document.createElement("div");
				containerEl.id = CONTAINER_ID;
				newWindow.document.body.appendChild(containerEl);
			}

			// Copy styles from parent (only for new windows to avoid duplication)
			if (shouldCopyStyles && !isExistingWindow) {
				styleCleanupRef.current = copyStyles(document, newWindow.document);
			}

			// Set container to trigger portal render
			setContainer(containerEl);

			// Notify that window is open
			onOpen?.(newWindow);
		}

		// Always set up event listeners and polling (even after Strict Mode remount)
		if (newWindow && !newWindow.closed) {
			handleBeforeUnload = () => release();
			newWindow.addEventListener("beforeunload", handleBeforeUnload);

			// Poll for window close (handles cross-origin and forced closes)
			pollInterval = setInterval(() => {
				if (!newWindow || newWindow.closed) {
					if (pollInterval) clearInterval(pollInterval);
					release();
				}
			}, 200);
		}

		return () => {
			mountedRef.current = false;

			if (pollInterval) clearInterval(pollInterval);
			if (newWindow && handleBeforeUnload) {
				newWindow.removeEventListener("beforeunload", handleBeforeUnload);
			}
			styleCleanupRef.current?.();

			// Defer window close to allow React Strict Mode remount
			// If component remounts immediately, mountedRef will be true again
			setTimeout(() => {
				if (!mountedRef.current && closeOnUnmountRef.current && newWindow && !newWindow.closed) {
					newWindow.close();
				}
			}, 0);
		};
	}, []); // Empty deps - only run on mount

	// Render portal when container is ready
	if (!container) {
		return null;
	}

	return createPortal(children, container);
}

export default NewWindow;
