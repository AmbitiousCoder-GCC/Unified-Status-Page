"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export const ScanlineOverlay = () => {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || theme !== "dark") return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50 mix-blend-overlay"
      style={{
        backgroundImage: "linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.25) 51%)",
        backgroundSize: "100% 4px"
      }}
    />
  );
};
