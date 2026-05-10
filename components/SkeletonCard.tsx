"use client";

import { motion } from "framer-motion";

export const SkeletonCard = () => {
  return (
    <div className="relative glass-card rounded-xl p-5 border-border-glow overflow-hidden animate-pulse">
      {/* HEADER ROW */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-surface/50 border border-border-glow/20" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-surface/50 rounded" />
            <div className="h-3 w-32 bg-surface/30 rounded" />
          </div>
        </div>
        <div className="w-16 h-5 bg-surface/50 rounded" />
      </div>

      {/* UPTIME RING PLACEHOLDER */}
      <div className="flex justify-center my-4">
        <div className="w-[120px] h-[120px] rounded-full border-[8px] border-surface/30" />
      </div>

      {/* SPARKLINE PLACEHOLDER */}
      <div className="h-[60px] w-full mt-4 bg-surface/20 rounded" />

      {/* COMPONENT STATUS LIST PLACEHOLDER */}
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-surface/50" />
              <div className="h-3 w-28 bg-surface/30 rounded" />
            </div>
            <div className="h-3 w-8 bg-surface/50 rounded" />
          </div>
        ))}
      </div>

      {/* FOOTER ROW */}
      <div className="mt-5 pt-3 border-t border-grid-line flex items-center justify-between">
        <div className="h-3 w-20 bg-surface/50 rounded" />
        <div className="h-3 w-16 bg-surface/30 rounded" />
      </div>
    </div>
  );
};
