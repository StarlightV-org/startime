/** biome-ignore-all lint/suspicious/noConsole: this is a utility function that prints to the console */
// @ts-ignore
import { inspect } from "node:util";
import chalk from "chalk";
import { formatDate } from "date-fns";
import type { TRPCError } from "@trpc/server";


/** Which `console.*` to use (affects stdout vs stderr in Node). */
export type PrintConsoleMethod = "log" | "error" | "warn" | "info" | "debug";

export interface PrintOptions {
	depth?: number;
	/** Defaults to `"log"`. Pass e.g. `"error"` for stderr. */
	method?: PrintConsoleMethod;
}

type PrintLogType =
  | "EXTEND"
	| "LOG"
	| "INFO"
	| "IMPORTANT"
	| "LOGGED"
	| "SUCCESS"
	| "FAIL"
	| "WARN"
	| "ERROR"
	| "ZOD"
	| "CRASH"
	| "DEBUG"
	| "STARTUP"
	| "API"
	| "API_ERROR"
	| "TRPC"
	| "TRPC_ERROR"
	| "MUTE"
	| "TIME"
	| "UNSTYLED"
	| "FULL_DATE";

/** DevTools use `%c` CSS, not ANSI — chalk is for Node terminals only. */
const isBrowser = typeof window !== "undefined";
/** Structured JSON logs are for Node in production only; the browser always uses styled console output. */
// @ts-ignore
const useProdJsonLogs = process.env.NODE_ENV === "production" && !isBrowser;
const defaultPrintOptions = {
	depth: 10,
	method: "log" satisfies PrintConsoleMethod,
} as const;

function isPrintOptions(o: unknown): o is PrintOptions {
	if (o === null || typeof o !== "object" || Array.isArray(o)) return false;
	if (o instanceof Date || o instanceof Error) return false;
	return "depth" in o || "method" in o;
}

/** Plain record suitable for spreading key → value in prod (named fields from one object arg). */
function isSpreadableRecord(v: unknown): v is Record<string, unknown> {
	if (v === null || typeof v !== "object") return false;
	if (Array.isArray(v)) return false;
	if (v instanceof Date || v instanceof Error) return false;
	const proto = Object.getPrototypeOf(v);
	return proto === Object.prototype || proto === null;
}

// Define the PrintFunction type before using it
type PrintFunction = {
	(...val: any[]): void;
	Unstyled: (...val: any[]) => void;
	Time: (title: string, minTime?: number, showStart?: boolean) => void;
	FullDate: () => void;
	Info: (...val: any[]) => void;
	Important: (...val: any[]) => void;
	Logged: (...val: any[]) => void;
	Success: (...val: any[]) => void;
	Fail: (...val: any[]) => void;
	Warning: (...val: any[]) => void;
	Error: (...val: any[]) => void;
	Zod: (vales: any[]) => void;
	Crash: (...val: any[]) => void;
	Debug: (...val: any[]) => void;
	StartUp: (...val: any[]) => void;
	API: (...val: any[]) => void;
	TRPC: (
		route: string,
		time: number,
		ctx: {
			name: string;
			id: string;
			session: string;

			ok: boolean;
		},
	) => void;
	TRPCError: (
		route: string | null | undefined,
		error: TRPCError,
		ctx: {
			name: string;
			id: string;
			session: string;

		},
	) => void;
	APIError: (...val: any[]) => void;
  Mute: (...val: any[]) => void;
  Extend: (data: Partial<{
    label: string;
    labelColor: string;
    valueColor: string;
    method: PrintConsoleMethod;
	}>) => void;
};

// Declare global Print function
declare global {
	// For NodeJS environment
	namespace NodeJS {
		interface Global {
			Print: PrintFunction;
		}
	}

	// For browser environment
	var Print: PrintFunction;
}

const createPrint = (() => {
	const formatPrintTime = () =>
		new Date().toLocaleString("de-DE", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});

	function toJsonSafeDetail(v: unknown): unknown {
		if (v instanceof Error) {
			return { name: v.name, message: v.message };
		}
		if (typeof v === "bigint") return v.toString();
		if (v === undefined) return null;
		if (typeof v === "function") return `[Function ${v.name || "anonymous"}]`;
		if (typeof v === "symbol") return v.toString();
		if (typeof v === "object" && v !== null) {
			try {
				return JSON.parse(JSON.stringify(v));
			} catch {
				return inspect(v, { depth: 6, colors: false });
			}
		}
		return v;
	}

	function argsToPayload(args: unknown[]): Record<string, unknown> {
		if (args.length === 1 && isSpreadableRecord(args[0])) {
			const o = args[0];
			const out: Record<string, unknown> = {};
			for (const k of Object.keys(o)) {
				out[k] = toJsonSafeDetail(o[k]);
			}
			return out;
		}
		const out: Record<string, unknown> = {};
		for (let i = 0; i < args.length; i++) {
			out[`arg${i}`] = toJsonSafeDetail(args[i]);
		}
		return out;
	}

	function timestampBracket(date: string) {
		return `[${date}]`;
	}

	/** Lowercase severity for log aggregators (Dozzle, etc.) that expect `level` / ECS-style fields. */
	function resolveJsonLogLevel(type: PrintLogType, method: PrintConsoleMethod): string {
		switch (type) {
			case "ERROR":
			case "CRASH":
			case "ZOD":
			case "TRPC_ERROR":
			case "API_ERROR":
				return "error";
			case "WARN":
				return "warn";
			case "SUCCESS":
			case "FAIL":
				return "trace";
			case "DEBUG":
				return "debug";
			default:
				break;
		}
		switch (method) {
			case "error":
				return "error";
			case "warn":
				return "warn";
			case "debug":
				return "debug";
			default:
				return "info";
		}
	}

	function writeProdJson(
		type: PrintLogType,
		method: PrintConsoleMethod,
		date: string,
		args: unknown[],
		extra?: Record<string, unknown>,
	) {
		const mergedExtra: Record<string, unknown> = {};
		if (extra) {
			for (const k of Object.keys(extra)) {
				mergedExtra[k] = toJsonSafeDetail(extra[k]);
			}
		}
		const level = resolveJsonLogLevel(type, method);
		const body: Record<string, unknown> = {
			...argsToPayload(args),
			...mergedExtra,
			type,
			severity: level,
			timestamp: new Date(),
			time: timestampBracket(date),
    };
    // @ts-ignore
		console[method](process.env.NODE_ENV === "development" ? body : JSON.stringify(body));
	}

	const stampColor = "#606060";
	const cReset = "";

	const browserSlv = {
		fmtPrefix: `%cNOVA%c `,
		styles: [`color: ${stampColor}; font-weight: 800;`, cReset] as const,
	};

	/** Avoid `%` in payloads breaking `console.*` format strings that use `%c`. */
	function escapeConsolePct(s: string) {
		return s.replaceAll("%", "%%");
	}

	function printStyledLine(method: PrintConsoleMethod, date: string, ...parts: unknown[]) {
		if (isBrowser) {
			console[method](
				`${browserSlv.fmtPrefix}%c[${date}]%c`,
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				...parts,
			);
			return;
		}
		console[method](chalk.bgHex(stampColor)(" "), chalk.hex(stampColor).bold(`[${date}]`), ...parts);
	}

	function formatDevInspectParts(vals: unknown[], depth: number): unknown[] {
		return vals.map((v) => {
			if (v === null || typeof v !== "object") return v;
			// Browser: keep live references so `File`, `Blob`, DOM nodes, etc. show correctly in DevTools.
			if (isBrowser) return v;
			return inspect(v, { depth, colors: true });
		});
	}

	/** Timestamp row + colored badge + payload (browser: `%c`; Node: chalk + inspect colors). */
	function printDevLabeledLine(
		method: PrintConsoleMethod,
		badge: { color: string; text: string },
		vals: unknown[],
		depth: number,
	) {
		const date = formatPrintTime();
		const formatted = formatDevInspectParts(vals, depth);
		if (isBrowser) {
			console[method](
				`${browserSlv.fmtPrefix}%c[${date}]%c %c${badge.text}%c`,
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				`color: ${badge.color};`,
				cReset,
				...formatted,
			);
			return;
		}
		printStyledLine(method, date, chalk.hex(badge.color)(badge.text), ...formatted);
	}

	function popPrintOptions(
		vals: any[],
		defaults?: Partial<Pick<PrintOptions, "depth" | "method">>,
	): { depth: number; method: PrintConsoleMethod; args: any[] } {
		const popped = vals.length > 0 && isPrintOptions(vals[vals.length - 1]) ? (vals.pop() as PrintOptions) : {};
		return {
			depth: popped.depth ?? defaults?.depth ?? defaultPrintOptions.depth,
			method: popped.method ?? defaults?.method ?? defaultPrintOptions.method,
			args: vals,
		};
	}

	/** `%s` / `%c` / `%o` / `%O` / `%d` / `%i` / `%f` — DevTools substitution (e.g. tRPC `loggerLink`). */
	function looksLikeConsoleFormatFirstArg(v: unknown): v is string {
		return typeof v === "string" && /%[sdifocO]/.test(v);
	}

	const printFunc = ((...val: any[]) => {
		if (val.length === 0) return printFunc("EMPTY PRINT");

		const date = formatPrintTime();

		const popped = val.length > 0 && isPrintOptions(val[val.length - 1]) ? (val.pop() as PrintOptions) : {};
		const depth = popped.depth ?? defaultPrintOptions.depth;
		const method = popped.method ?? defaultPrintOptions.method;

		if (useProdJsonLogs) {
			writeProdJson("LOG", method, date, val);
			return;
		}

		/** Keep `%c` / `%O` args aligned (tRPC `loggerLink`, etc.); only prefix SLV + timestamp. */
		if (isBrowser && val.length >= 2 && looksLikeConsoleFormatFirstArg(val[0])) {
			const [fmt, ...nativeRest] = val as [string, ...unknown[]];
			console[method](
				`${browserSlv.fmtPrefix}%c[${date}]%c ${fmt}`,
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				...nativeRest,
			);
			return;
		}

		const formattedValues = formatDevInspectParts(val, depth);

		printStyledLine(method, date, ...formattedValues);
	}) as PrintFunction;

	printFunc.Unstyled = (...val: any[]) => {
		if (val.length === 0) return;

		const date = formatPrintTime();
		if (useProdJsonLogs) {
			writeProdJson("UNSTYLED", "log", date, val);
			return;
		}

		const color = "#505050";
		if (isBrowser) {
			console.log(`${browserSlv.fmtPrefix}`, ...browserSlv.styles, ...val);
			return;
		}
		console.log(chalk.bgHex(color)(" "), ...val);
	};

	// MARK: Time Prints

	const active: { [key: string]: string } = {};
	const timers: { [key: string]: number } = {};
	printFunc.Time = (title: string, minTime = 1000, showStart = false) => {
		if (active[title]) {
			const elapsed = Date.now() - timers[title]!;
			if (elapsed >= minTime) {
				const date = formatPrintTime();
				if (useProdJsonLogs) {
					writeProdJson("TIME", "log", date, [], {
						title: active[title],
						elapsedMs: elapsed,
						phase: "end",
					});
				} else if (isBrowser) {
					console.log(
						`${browserSlv.fmtPrefix}%c[${date}]%c %c[TIME]%c ${active[title]}: %c${elapsed}ms%c`,
						...browserSlv.styles,
						`color: ${stampColor}; font-weight: bold;`,
						cReset,
						`color: #6aabff;`,
						cReset,
						cReset,
						`color: #f5d742;`,
						cReset,
					);
				} else {
					printFunc(`${chalk.blue("[TIME]")} ${active[title]}: ${chalk.yellow(`${elapsed}ms`)}`);
				}
			}

			delete active[title];
			delete timers[title];
		} else {
			if (showStart) {
				const date = formatPrintTime();
				if (useProdJsonLogs) {
					writeProdJson("TIME", "log", date, [], { title, phase: "start" });
				} else if (isBrowser) {
					console.log(
						`${browserSlv.fmtPrefix}%c[${date}]%c %c[TIME]%c ${title}`,
						...browserSlv.styles,
						`color: ${stampColor}; font-weight: bold;`,
						cReset,
						`color: #6aabff;`,
						cReset,
					);
				} else {
					printFunc(`${chalk.blue("[TIME]")} ${title}`);
				}
			}
			active[title] = title;
			timers[title] = Date.now();
		}
	};

	printFunc.FullDate = () => {
		const formatted = formatDate(new Date(), "dd.MM.yyyy HH:mm:ss");
		if (useProdJsonLogs) {
			writeProdJson("FULL_DATE", "log", formatPrintTime(), [formatted]);
			return;
		}
		printFunc.Unstyled(formatted);
	};

	// MARK: Info Prints

	printFunc.Info = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("INFO", "info", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v, { method: "info" });
		printDevLabeledLine(method, { color: "#5ff55f", text: "[INFO]" }, args, depth);
	};

	printFunc.Important = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("IMPORTANT", "info", formatPrintTime(), val);
			return;
		}
		const valStr = val.join(" | ");
		const borderLength = valStr.length + 2;
		const upperBorder = `╔${"═".repeat(borderLength)}╗`;
		const lowerBorder = `╚${"═".repeat(borderLength)}╝`;

		printFunc(upperBorder, { method: "info" });
		printFunc(`║ ${valStr} ║`, { method: "info" });
		printFunc(lowerBorder, { method: "info" });
	};

	printFunc.Logged = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("LOGGED", "log", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v);
		printDevLabeledLine(method, { color: "#aaffaa", text: "[LOGGED]" }, args, depth);
	};

	printFunc.Success = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("SUCCESS", "debug", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v);
		printDevLabeledLine(method, { color: "#20ff20", text: "[SUCCESS]" }, args, depth);
	};
	printFunc.Fail = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("FAIL", "debug", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v, { method: "debug" });
		printDevLabeledLine(method, { color: "#ff2020", text: "[FAIL]" }, args, depth);
	};

	printFunc.Warning = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("WARN", "warn", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v, { method: "warn" });
		printDevLabeledLine(method, { color: "#f0f000", text: "[WARNING]" }, args, depth);
	};

	printFunc.Error = (...val: any[]) => {
		const dateShort = formatPrintTime();
		if (useProdJsonLogs) {
			writeProdJson("ERROR", "error", dateShort, val);
			return;
		}
		const timestamp = timestampBracket(dateShort);
		const body: Record<string, unknown> = { timestamp };
		if (val.length === 0) body.message = "EMPTY ERROR";
		else if (val.length === 1) body.detail = toJsonSafeDetail(val[0]);
		else body.details = val.map(toJsonSafeDetail);

		const json = escapeConsolePct(JSON.stringify(body, null, 2));
		if (isBrowser) {
			console.error(
				`${browserSlv.fmtPrefix}%c[${dateShort}]%c %c${json}`,
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				`color: #ff6666; white-space: pre;`,
			);
		} else {
			printStyledLine("error", dateShort, chalk.hex("#F66")(json));
		}
	};

	printFunc.Zod = (vales: any[]) => {
		const elements: string[] = [];
		for (const val of vales) {
			switch (val.code) {
				case "invalid_type":
					if (val.received === "undefined") elements.push(`${val.path[0]}: required as ${val.expected}.`);
					else elements.push(`"${val.path[0]}": recived ${val.received} expected ${val.expected}.`);
					break;

				default:
					elements.push(`${val.code} - "${val.path[0]}": ${val.message}.`);
					break;
			}
		}

		if (useProdJsonLogs) {
			writeProdJson("ZOD", "error", formatPrintTime(), [], { issues: elements });
			return;
		}

		for (const elem of elements) {
			printDevLabeledLine("error", { color: "#d0bf00", text: "[ZOD]" }, [elem], defaultPrintOptions.depth);
		}
	};

	printFunc.Crash = (...val: any[]) => {
		const dateShort = formatPrintTime();
		if (useProdJsonLogs) {
			writeProdJson("CRASH", "error", dateShort, val, { crash: true });
			return;
		}
		const timestamp = timestampBracket(dateShort);
		const body: Record<string, unknown> = { timestamp, crash: true };
		if (val.length === 0) body.message = "EMPTY CRASH";
		else if (val.length === 1) body.detail = toJsonSafeDetail(val[0]);
		else body.details = val.map(toJsonSafeDetail);

		const crashJson = escapeConsolePct(JSON.stringify(body, null, 2));
		if (isBrowser) {
			console.error(
				`${browserSlv.fmtPrefix}%c[${dateShort}]%c %c${crashJson}`,
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				`background: #c62828; color: #fff; white-space: pre;`,
			);
		} else {
			printStyledLine("error", dateShort, chalk.bgRed.white(crashJson));
		}
	};

	// MARK: Misc Prints

	printFunc.Debug = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("DEBUG", "debug", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v, { method: "debug" });

		printDevLabeledLine(method, { color: "#da00da", text: "[DEBUG]" }, args, depth);
	};

	printFunc.StartUp = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("STARTUP", "info", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v, { method: "info" });
		printDevLabeledLine(method, { color: "#a6ffff", text: "[STARTUP]" }, args, depth);
	};

	printFunc.API = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("API", "log", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v);
		printDevLabeledLine(method, { color: "#5050ff", text: "[API]" }, args, depth);
	};

	// Generate a vibrant color from a string
	const stringToColor = (str: string): string => {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = str.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Use hash to generate hue (0-360) for vibrant colors
		const hue = Math.abs(hash) % 360;

		// Convert HSV to RGB with high saturation and brightness for vibrancy
		const saturation = 0.7 + (Math.abs(hash >> 8) % 30) / 100; // 0.7-1.0
		const brightness = 0.8 + (Math.abs(hash >> 16) % 20) / 100; // 0.8-1.0

		const c = brightness * saturation;
		const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
		const m = brightness - c;

		let r = 0,
			g = 0,
			b = 0;

		if (hue < 60) {
			r = c;
			g = x;
			b = 0;
		} else if (hue < 120) {
			r = x;
			g = c;
			b = 0;
		} else if (hue < 180) {
			r = 0;
			g = c;
			b = x;
		} else if (hue < 240) {
			r = 0;
			g = x;
			b = c;
		} else if (hue < 300) {
			r = x;
			g = 0;
			b = c;
		} else {
			r = c;
			g = 0;
			b = x;
		}

		const red = Math.round((r + m) * 255);
		const green = Math.round((g + m) * 255);
		const blue = Math.round((b + m) * 255);

		return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
	};

	printFunc.TRPC = (
		route: string,
		time: number,
		ctx: { name: string; id: string; session: string;  ok: boolean },
	) => {
		const date = formatPrintTime();
		if (useProdJsonLogs) {
			writeProdJson("TRPC", "log", date, [], {
				route,
				timeMs: time,
				name: ctx.name,
				id: ctx.id,
				session: ctx.session,

				ok: ctx.ok,
			});
			return;
		}
		const segments = route.split(".");
		if (isBrowser) {
			const styles: string[] = [
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				`color: #5555ff;`,
				cReset,
			];
			let fmt = `${browserSlv.fmtPrefix}%c[${date}]%c %c[TRPC]%c route: `;
			for (let i = 0; i < segments.length; i++) {
				const seg = segments[i];
				fmt += `%c${escapeConsolePct(seg!)}%c`;
				styles.push(`color: ${stringToColor(seg!)};`, cReset);
				if (i < segments.length - 1) {
					fmt += `%c.%c`;
					styles.push(`color: #888888;`, cReset);
				}
			}
			fmt += ` time: %c${time ?? 0}ms`;
			styles.push(`color: #fa0faa;`);
			console.log(fmt, ...styles);
			return;
		}

		const coloredSegments = segments.map((segment) => {
			const color = stringToColor(segment);
			return chalk.hex(color)(segment);
		});

		const routeString = coloredSegments.join(chalk.hex("#888888")("."));

		printFunc(
			`${chalk.hex("#5555ff")("[TRPC]")}`,
			"route:",
			routeString,
			"time:",
			chalk.hex("#fa0faa")(`${time ?? 0}ms`),
		);
	};

	printFunc.TRPCError = (
		route: string | null | undefined,
		error: TRPCError,
		ctx: {
			name: string;
			id: string;
			session: string;

		},
	) => {
		const path = route ?? "<no-path>";
		const date = formatPrintTime();
		if (useProdJsonLogs) {
			writeProdJson("TRPC_ERROR", "error", date, [], {
				route: path,
				error: error.message,

				code: error.code,
				name: ctx.name,
				id: ctx.id,
				session: ctx.session,

			});
			return;
		}
		const segments = path.split(".");

		if (isBrowser) {
			const styles: string[] = [
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				`color: #ff6666;`,
				cReset,
				`color: #ff6666;`,
				cReset,
			];
			let fmt = `${browserSlv.fmtPrefix}%c[${date}]%c %c[TRPC-ERROR]%c %c❌ failed on%c `;
			for (let i = 0; i < segments.length; i++) {
				const seg = segments[i];
				fmt += `%c${escapeConsolePct(seg!)}%c`;
				styles.push(`color: ${stringToColor(seg!)};`, cReset);
				if (i < segments.length - 1) {
					fmt += `%c.%c`;
					styles.push(`color: #888888;`, cReset);
				}
			}
			fmt += `: %c${escapeConsolePct(String(error))}`;
			styles.push(`color: #ff2020; font-weight: bold;`);
			console.error(fmt, ...styles);
			return;
		}

		const coloredSegments = segments.map((segment) => {
			const color = stringToColor(segment);
			return chalk.hex(color)(segment);
		});

		const routeString = coloredSegments.join(chalk.hex("#888888")("."));

		printFunc(
			`${chalk.hex("#F66")("[TRPC-ERROR]")}`,
			chalk.hex("#F66")("❌ failed on"),
			routeString,
			":",
			chalk.hex("#FF2020").bold(error),
			{ method: "error" },
		);
	};

	printFunc.APIError = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("API_ERROR", "error", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v, { method: "error" });
		const formatted = formatDevInspectParts(args, depth);
		const d = formatPrintTime();
		if (isBrowser) {
			console[method](
				`${browserSlv.fmtPrefix}%c[${d}]%c %c[API]%c %c[ERROR]%c`,
				...browserSlv.styles,
				`color: ${stampColor}; font-weight: bold;`,
				cReset,
				`color: #5050ff;`,
				cReset,
				`color: #ff6666;`,
				cReset,
				...formatted,
			);
		} else {
			printStyledLine(method, d, chalk.hex("#5050FF")("[API]"), chalk.hex("#F66")("[ERROR]"), ...formatted);
		}
	};

	printFunc.Mute = (...val: any[]) => {
		if (useProdJsonLogs) {
			writeProdJson("MUTE", "log", formatPrintTime(), val);
			return;
		}
		const v = [...val];
		const { depth, method, args } = popPrintOptions(v);
		printDevLabeledLine(method, { color: "#ff5555", text: "[MUTE]" }, args, depth);
  };

	printFunc.Extend = (data: Partial<{
		label: string;
		labelColor: string;
		valueColor: string;
		method: PrintConsoleMethod;
	}>) => {
		const label = data.label ?? "";
		const labelColor = data.labelColor ?? "#5050ff";
		const valueColor = data.valueColor ?? "#a6ffff";
		const method = data.method ?? "info";
		const color = labelColor;
		const labelText = label ? `${label} ` : "";
		const valueColorReset = valueColor ? `; color: ${valueColor}` : "";
		const extendedPrint = (val: any[]) => {
			printStyledLine(method, formatPrintTime(), chalk.hex(color)(labelText), ...val.map((v) => chalk.hex(valueColor)(v.toString())).concat(valueColorReset));
		};
		return extendedPrint;
	};

	return printFunc;
})();

// Assign to global scope
// biome-ignore lint/suspicious/noRedeclare: this is the global print function
const Print = createPrint;

// Make Print available globally in both Node and browser environments
if (typeof window !== "undefined") {
	// Browser environment
	(window as any).Print = Print;
} else {
	// Node environment
	// @ts-ignore
	(global as any).Print = Print;
}

export default Print;
