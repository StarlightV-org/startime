import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ShortUniqueId from "short-unique-id";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

type Success<T> = {
	data: T;
	error?: never;
};

type Failure<E> = {
	data?: never;
	error: E;
};

type Result<T, E = Error> = Success<T> | Failure<E>;

type MaybePromise<T> = T | Promise<T>;

export function tryCatch<T, E = Error>(
	arg: Promise<T> | (() => MaybePromise<T>),
): Result<T, E> | Promise<Result<T, E>> {
	if (typeof arg === "function") {
		try {
			const result = arg();

			return result instanceof Promise ? tryCatch(result) : { data: result };
		} catch (error) {
			return { error: error as E };
		}
	}

	return arg.then((data) => ({ data })).catch((error) => ({ error: error as E }));
}

export function generateShortId(totalLength = 16): string {
	const length = totalLength % 2 === 0 ? totalLength / 2 : Math.ceil(totalLength / 2);
	const { randomUUID: uuidNumber } = new ShortUniqueId({
		length,
		dictionary: "number",
	});
	const { randomUUID: uuidLetter } = new ShortUniqueId({
		length,
		dictionary: "alpha_upper",
	});
	return `${uuidLetter()}${uuidNumber()}`;
}
