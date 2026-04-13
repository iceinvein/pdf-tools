import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

type ModeToggleProps = {
	className?: string;
};

export function ModeToggle({ className }: ModeToggleProps) {
	const { theme, setTheme } = useTheme();

	const isDark =
		theme === "dark" ||
		(theme === "system" &&
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			title={isDark ? "Light mode" : "Dark mode"}
			className={className}
		>
			<Sun className="hidden dark:block" />
			<Moon className="dark:hidden" />
		</Button>
	);
}
