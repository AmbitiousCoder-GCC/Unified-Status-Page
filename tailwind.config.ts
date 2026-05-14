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
      keyframes: {
        "hologram-flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
          "25%, 75%": { opacity: "0.95", transform: "translateY(0.5px)" },
        },
        "scanline": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "hud-pulse": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.7", filter: "brightness(1.5)" },
        },
      },
      animation: {
        "hologram": "hologram-flicker 4s infinite alternate",
        "scanline": "scanline 8s linear infinite",
        "hud-pulse": "hud-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
  darkMode: ["class", "[data-theme='dark']"],
};
export default config;
