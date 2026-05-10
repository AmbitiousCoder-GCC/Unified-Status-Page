"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const UptimeRing = ({ uptimePct }: { uptimePct: number }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Wait for mount to animate to the correct value, avoiding hydration mismatch
  const offset = mounted ? circumference - (uptimePct / 100) * circumference : circumference;

  let color = "var(--accent-danger)";
  if (uptimePct >= 99) color = "var(--accent-success)";
  else if (uptimePct >= 95) color = "var(--accent-warn)";

  return (
    <div className="relative flex flex-col items-center justify-center my-4">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--grid-line)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-spacemono text-xl font-bold text-text-primary" style={{ textShadow: `0 0 8px ${color}` }}>
          {uptimePct.toFixed(2)}%
        </span>
        <span className="text-[9px] uppercase tracking-wider text-text-muted mt-1 font-orbitron">
          15-Day Uptime
        </span>
      </div>
    </div>
  );
};
