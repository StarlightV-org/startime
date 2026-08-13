"use client";

import Print, { type PrintOptions } from "./print";

export type ConsoleEsque = Pick<
  Console,
  "debug" | "error" | "info" | "log" | "warn"
>;

const p = Print as (...args: unknown[]) => void;

function withMethod(method: NonNullable<PrintOptions["method"]>) {
  return (...args: unknown[]) => p(...args, { method } satisfies PrintOptions);
}

/**
 * Maps the standard console channels onto {@link Print} so libraries that accept a logger can use Print styling in the browser.
 */
export function createPrintBinding(): ConsoleEsque {
  return {
    log: (...args: unknown[]) => p(...args),
    debug: withMethod("debug"),
    error: withMethod("error"),
    info: withMethod("info"),
    warn: withMethod("warn"),
  };
}

/** Shared instance when you do not need per-call configuration. */
export const printBinding: ConsoleEsque = createPrintBinding();
