import { Card, CardContent } from "~/components/ui/card";
import { HeaderBar } from "~/components/ui/header-bar";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto min-h-screen max-w-250 px-5 pb-15">
			<HeaderBar showTabs={false} showUser={false} />
			<Card className="">
				<CardContent>
					<article className="prose max-w-none prose-neutral dark:prose-invert prose-code:before:content-none prose-code:after:content-none">
						{children}
					</article>
				</CardContent>
			</Card>
		</div>
	);
}
