type NeverNull<T> = T extends (...args: any[]) => any
	? T
	: T extends object
		? { [K in keyof T]-?: NeverNull<NonNullable<T[K]>> }
		: NonNullable<T>;
