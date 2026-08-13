import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign in | Startime",
	description: "Sign in to your Startime workspace.",
};

export default function AuthPage() {
	return (
		<main className="auth-shell">
			<section className="auth-intro" aria-label="Startime introduction">
				<a className="brand" href="/">
					startime<span>.</span>
				</a>
				<div className="auth-intro-copy">
					<p className="eyebrow">TIME, MADE CLEAR</p>
					<h1>Make room for what matters.</h1>
					<p>Startime brings your time, focus, and progress into one calm place.</p>
				</div>
				<div className="auth-quote">
					<span>“</span>
					<p>Small, consistent steps make the biggest difference.</p>
				</div>
			</section>
			<section className="auth-panel"></section>
		</main>
	);
}
