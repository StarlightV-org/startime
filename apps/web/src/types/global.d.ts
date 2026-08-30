type NeverNull<T> = T extends (...args: any[]) => any
	? T
	: T extends object
		? { [K in keyof T]-?: NeverNull<NonNullable<T[K]>> }
		: NonNullable<T>;

import "react";
import type { PermissionString } from "~/types/permissionsTypes";

declare module "react" {
	interface DOMAttributes<T> {
		"data-docs"?: string;
	}

	interface InputHTMLAttributes<T> extends React.InputHTMLAttributes<T> {
		"data-op-ignore"?: true;
	}
}
