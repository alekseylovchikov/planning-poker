import type { Theme } from "../hooks/useTheme";
import styles from "./ThemeToggleButton.module.scss";

interface ThemeToggleButtonProps {
  theme: Theme;
  onToggle: () => void;
}

function SunIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M22 12h-2M4 12H2M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41M19.07 19.07l-1.41-1.41M6.34 6.34L4.93 4.93"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3c-.05.33-.08.67-.08 1.01a8 8 0 0 0 8 8c.34 0 .68-.03 1.01-.08Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggleButton({ theme, onToggle }: ThemeToggleButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onToggle}
      aria-label={
        theme === "dark" ? "Включить светлую тему" : "Включить темную тему"
      }
      title={theme === "dark" ? "Светлая тема" : "Темная тема"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
