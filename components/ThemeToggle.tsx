"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-12 h-6" />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center w-14 h-7 bg-surface rounded-full p-1 border border-border-glow shadow-[0_0_10px_var(--border-glow)]"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      <motion.div
        className="w-5 h-5 rounded-full bg-accent-primary flex items-center justify-center text-base z-10"
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        initial={false}
        animate={{
          x: isDark ? 26 : 0,
        }}
      >
        {isDark ? <Moon size={12} className="text-surface" /> : <Sun size={12} className="text-surface" />}
      </motion.div>
    </button>
  );
};
