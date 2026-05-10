import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        card: "var(--bg-card)",
        accent: {
          primary: "var(--accent-primary)",
          secondary: "var(--accent-secondary)",
          warn: "var(--accent-warn)",
          danger: "var(--accent-danger)",
          success: "var(--accent-success)",
        },
        text: {
          primary: "var(--text-primary)",
          muted: "var(--text-muted)",
        },
        "border-glow": "var(--border-glow)",
        border: "var(--border)",
      },
      fontFamily: {
        orbitron: ["var(--font-orbitron)"],
        spacemono: ["var(--font-space-mono)"],
        dmsans: ["var(--font-dm-sans)"],
      },
    },
  },
  plugins: [],
  darkMode: ["class", "[data-theme='dark']"],
};
export default config;
