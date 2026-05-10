"use client";

import { motion, AnimatePresence } from "framer-motion";
import { VendorStatus } from "@/types/status";
import { AlertCircle, CheckCircle } from "lucide-react";

export const GlobalStatusBar = ({ statuses }: { statuses: VendorStatus[] }) => {
  if (!statuses || statuses.length === 0) return null;

  const incidentsCount = statuses.reduce(
    (acc, s) => acc + (s.overallStatus.includes("outage") || s.overallStatus === "degraded" ? 1 : 0), 
    0
  );

  const isAllClear = incidentsCount === 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isAllClear ? "clear" : "incidents"}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`w-full py-2 px-4 flex items-center justify-center gap-3 transition-colors duration-500 shadow-md z-30 relative`}
        style={{
          backgroundColor: isAllClear ? "var(--accent-success)" : "var(--accent-warn)",
          color: isAllClear ? "#020818" : "#fff" // Ensuring readability on both themes
        }}
      >
        {isAllClear ? (
          <>
            <CheckCircle size={16} className="animate-pulse" />
            <span className="font-orbitron font-bold text-sm tracking-widest uppercase">
              ALL SYSTEMS OPERATIONAL
            </span>
          </>
        ) : (
          <>
            <AlertCircle size={16} className="animate-pulse" />
            <span className="font-orbitron font-bold text-sm tracking-widest uppercase">
              {incidentsCount} VENDOR{incidentsCount > 1 ? "S" : ""} EXPERIENCING ISSUES
            </span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
