import { HeaderBar } from "~/components/ui/header-bar";
import { api } from "~/trpc/server";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto min-h-screen max-w-250 px-5 pb-16">
			<HeaderBar />
			{children}
		</div>
	);
}


