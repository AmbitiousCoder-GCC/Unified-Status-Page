"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export const HeroHeader = ({ lastFetched }: { lastFetched?: string }) => {
  const [time, setTime] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const timeSinceFetch = lastFetched 
    ? Math.floor((new Date().getTime() - new Date(lastFetched).getTime()) / 1000)
    : 0;

  return (
    <header className="w-full h-20 border-b border-border-glow bg-surface/80 backdrop-blur-md sticky top-0 z-40">
      {/* Bottom border gradient */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-accent-primary/0 via-accent-primary to-accent-primary/0" />
      
      <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between">
        {/* LEFT: Logo & Title */}
        <div className="flex items-center gap-4">
          <motion.div 
            className="w-10 h-10 rounded-lg bg-card border border-border-glow flex items-center justify-center shadow-[0_0_15px_var(--border-glow)]"
            animate={{ boxShadow: ["0 0 10px var(--border-glow)", "0 0 20px var(--border-glow)", "0 0 10px var(--border-glow)"] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Activity className="text-accent-primary" />
          </motion.div>
          <div>
            <h1 className="font-orbitron text-xl md:text-2xl font-bold tracking-wider text-text-primary uppercase" style={{ textShadow: "0 0 10px var(--accent-primary)" }}>
              NEXUS STATUS GRID
            </h1>
          </div>
        </div>

        {/* CENTER: Clock & Live Badge */}
        <div className="hidden md:flex flex-col items-center justify-center">
          <div className="font-spacemono text-xl tracking-widest text-text-primary">
            {mounted ? time : "00:00:00"}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-danger opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-danger shadow-[0_0_8px_var(--accent-danger)]"></span>
            </span>
            <span className="text-[10px] font-orbitron text-accent-danger uppercase tracking-widest font-bold">
              LIVE FEED
            </span>
          </div>
        </div>

        {/* RIGHT: Theme Toggle & Sync */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-orbitron text-text-muted uppercase">Last Synced</span>
            <span className="font-spacemono text-xs text-text-primary">
              {mounted && lastFetched ? `${timeSinceFetch}s ago` : "Waiting..."}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
