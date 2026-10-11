import type { Config } from "tailwindcss";

/**
 * Every colour resolves to a CSS custom property declared in app/globals.css.
 * The variable is the single source of truth: changing it there recolours the
 * token everywhere, including the SVG that references it directly.
 */
const token = (name: string) => `var(--c-${name})`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        blot: token("blot"),
        ink: token("ink"),
        shell: token("shell"),
        // Paper cards
        paper: token("paper"),
        "paper-alt": token("paper-alt"),
        "paper-deep": token("paper-deep"),
        // Text on paper
        "ink-strong": token("ink-strong"),
        "ink-body": token("ink-body"),
        "ink-mute": token("ink-mute"),
        "ink-faint": token("ink-faint"),
        // Text on dark
        mute: token("mute"),
        "mute-dim": token("mute-dim"),
        "mute-faint": token("mute-faint"),
        // Accent
        lime: token("lime"),
        "lime-deep": token("lime-deep"),
        "lime-alt": token("lime-alt"),
        "lime-wash": token("lime-wash"),
        // Positive
        moss: token("moss"),
        "moss-deep": token("moss-deep"),
        "moss-alt": token("moss-alt"),
        // Negative
        warn: token("warn"),
        "warn-deep": token("warn-deep"),
        alert: token("alert"),
        "alert-alt": token("alert-alt"),
        "alert-deep": token("alert-deep"),
        "alert-wash": token("alert-wash"),
        // Caution
        amber: token("amber"),
        "amber-deep": token("amber-deep"),
        gold: token("gold"),
        // Informational
        slate: token("slate"),
        "slate-deep": token("slate-deep"),
        sky: token("sky"),
        "slate-light": token("slate-light"),
        "slate-mid": token("slate-mid"),
        "slate-text": token("slate-text"),
        "slate-pale": token("slate-pale"),
        "slate-line": token("slate-line"),
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        paper: "0 24px 60px -28px rgba(16, 14, 12, 0.55)",
      },
    },
  },
  plugins: [],
};

export default config;