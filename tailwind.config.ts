import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blot: "#100e0c",
        ink: "#1a1612",
        paper: "#f3eee4",
        copper: "#c45c26",
        moss: "#3f5c48",
        rule: "#d7cfc2",
        warn: "#8f3d2c",
        mute: "#8a8175",
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
