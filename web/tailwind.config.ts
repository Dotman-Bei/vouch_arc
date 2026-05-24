import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "'IBM Plex Mono'", "'Space Mono'", "'Courier New'", "Courier", "monospace"],
      },
      colors: {
        bg: {
          primary:   "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary:  "var(--bg-tertiary)",
          hover:     "var(--bg-hover)",
        },
        fg: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary:  "var(--text-tertiary)",
          inverse:   "var(--text-inverse)",
        },
        accent: {
          green:    "var(--accent-green)",
          greenDim: "var(--accent-green-dim)",
          greenBg:  "var(--accent-green-bg)",
          amber:    "var(--accent-amber)",
          amberBg:  "var(--accent-amber-bg)",
        },
        status: {
          good:   "var(--status-good)",
          warn:   "var(--status-warn)",
          danger: "var(--status-danger)",
        },
        line: {
          DEFAULT: "var(--border-default)",
          strong:  "var(--border-strong)",
          accent:  "var(--border-accent)",
        },
      },
      maxWidth: { content: "860px" },
      fontSize: {
        xs:   ["11px", { lineHeight: "1.5" }],
        sm:   ["13px", { lineHeight: "1.6" }],
        base: ["15px", { lineHeight: "1.7" }],
        md:   ["17px", { lineHeight: "1.5" }],
        lg:   ["22px", { lineHeight: "1.3" }],
        xl:   ["32px", { lineHeight: "1.3" }],
        "2xl":["48px", { lineHeight: "1.2" }],
      },
      borderRadius: { DEFAULT: "2px", card: "4px" },
    },
  },
  plugins: [],
} satisfies Config;
