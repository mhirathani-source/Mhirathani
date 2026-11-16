import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const STORAGE_KEY = "prime-theme";

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The current page still updates when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent("prime-theme-change", { detail: theme }));
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle"
      data-testid="toggle-theme"
      aria-label={theme === "dark" ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن"}
      aria-pressed={theme === "dark"}
      onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      <span>{theme === "dark" ? "فاتح" : "داكن"}</span>
    </button>
  );
}
