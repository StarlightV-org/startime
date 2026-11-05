import { HeaderBar } from "~/components/ui/header-bar";
import { api } from "~/trpc/server";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-250 px-4 pb-10 sm:px-5 sm:pb-16">
			<HeaderBar />
			{children}
		</div>
	);
}
