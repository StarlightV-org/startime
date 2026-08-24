import { cn } from "~/lib/utils";
import { getLanguageIconSrc } from "../../lib/languageIcons";

export function FileIcons({ language, className }: { language: string; className?: string }) {
	const iconSrc = getLanguageIconSrc(language);

	if (!iconSrc) return null;

	return <img src={iconSrc} alt={language} className={cn("size-4 rounded-full", className)} />;
}


