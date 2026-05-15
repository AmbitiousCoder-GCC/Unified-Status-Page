"use client";

import { motion, useReducedMotion } from "framer-motion";
import { VendorStatus } from "@/types/status";
import { VENDORS_LIST } from "@/lib/vendors";
import { UptimeRing } from "./UptimeRing";
import { UptimeSparkline } from "./UptimeSparkline";
import { AlertTriangle, CheckCircle, Wrench, Clock } from "lucide-react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";

interface VendorCardProps {
  status: VendorStatus;
  index: number;
  onClick: () => void;
}

export const VendorCard = ({ status, index, onClick }: VendorCardProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [lastUpdated, setLastUpdated] = useState<string>("recently");
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const fetchedDate = new Date(status.fetchedAt);
      setLastUpdated(formatDistanceToNow(fetchedDate, { addSuffix: true }));
      setIsStale((new Date().getTime() - fetchedDate.getTime()) > 15 * 60 * 1000);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [status.fetchedAt]);

  const vendorConfig = VENDORS_LIST.find(v => v.id === status.vendorId);
  if (!vendorConfig) return null;

  const isOutage = status.overallStatus.includes("outage");
  const isDegraded = status.overallStatus === "degraded";
  const isMaintenance = status.overallStatus === "maintenance";
  const isOperational = status.overallStatus === "operational";

  const getStatusColor = () => {
    if (isOutage) return "var(--accent-danger)";
    if (isDegraded) return "var(--accent-warn)";
    if (isMaintenance) return "var(--accent-secondary)";
    if (isOperational) return "var(--accent-success)";
    return "var(--text-muted)";
  };



  const statusColor = getStatusColor();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      whileHover={shouldReduceMotion ? {} : { translateY: -6, boxShadow: `0 0 20px ${vendorConfig.accentColor}33` }}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      tabIndex={0}
      role="button"
      aria-label={`View status details for ${vendorConfig.name}`}
      className={`relative glass-card rounded-none border-t border-[var(--border-glow)] bg-[var(--bg-surface)]/20 p-5 cursor-pointer overflow-hidden transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-accent-primary
        ${status.activeIncidents.length > 0 ? "border-t-[var(--accent-danger)] animate-[pulse_2s_ease-in-out_infinite]" : "hover:border-t-[var(--hover-border)] hover:bg-[var(--bg-card)]/40 hover:shadow-[0_-5px_15px_-5px_var(--hover-border)]"}`}
      style={{
        "--hover-border": vendorConfig.accentColor,
      } as React.CSSProperties}
    >
      {/* HUD Corner Brackets - Reduced Opacity for cleaner look */}
      <svg className="absolute top-0 left-0 w-3 h-3 opacity-20 group-hover:opacity-60 transition-opacity" style={{ stroke: vendorConfig.accentColor }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="1.5" d="M4 12V4h8" /></svg>
      <svg className="absolute top-0 right-0 w-3 h-3 opacity-20 group-hover:opacity-60 transition-opacity" style={{ stroke: vendorConfig.accentColor }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="1.5" d="M20 12V4h-8" /></svg>
      <svg className="absolute bottom-0 left-0 w-3 h-3 opacity-20 group-hover:opacity-60 transition-opacity" style={{ stroke: vendorConfig.accentColor }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="1.5" d="M4 12v8h8" /></svg>
      <svg className="absolute bottom-0 right-0 w-3 h-3 opacity-20 group-hover:opacity-60 transition-opacity" style={{ stroke: vendorConfig.accentColor }} fill="none" viewBox="0 0 24 24"><path strokeLinecap="square" strokeWidth="1.5" d="M20 12v8h-8" /></svg>
      
      {/* Telemetry ID Overlay - Minimalist */}
      <div className="absolute top-2 right-4 text-[7px] font-spacemono text-text-muted/30 uppercase pointer-events-none transition-opacity group-hover:opacity-100">
        ID:{vendorConfig.id.substring(0, 4)}
      </div>
      {/* Background glow using accent color */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${vendorConfig.accentColor}, transparent 70%)` }}
      />

      {isStale && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500/20 text-yellow-500 text-[9px] font-spacemono text-center py-0.5 border-b border-yellow-500/30 uppercase">
          ⚠ Stale Data Warning
        </div>
      )}

      {/* HEADER ROW */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3 mt-2">
          {/* We'll use a generic icon placeholder until logos are available or load actual images */}
          <div className="w-8 h-8 bg-surface/50 flex items-center justify-center p-1 relative" style={{ border: `1px solid ${vendorConfig.accentColor}40` }}>
            <div className="absolute inset-0 opacity-20" style={{ background: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${vendorConfig.accentColor} 2px, ${vendorConfig.accentColor} 4px)` }} />
            {/* Fallback to text if image fails or isn't there */}
            <span className="font-orbitron font-bold text-xs" style={{ color: vendorConfig.accentColor }}>
              {vendorConfig.name.substring(0,2).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-orbitron text-sm uppercase tracking-wider text-text-primary">
              {vendorConfig.name}
            </h3>
            <p className="font-dmsans text-[11px] text-text-muted">
              {vendorConfig.description}
            </p>
          </div>
        </div>
        <div 
          className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border"
          style={{ 
            color: statusColor, 
            borderColor: `${statusColor}40`,
            backgroundColor: `${statusColor}10`,
            textShadow: `0 0 5px ${statusColor}`
          }}
        >
          {isOperational && <CheckCircle size={10} />}
          {isDegraded && <AlertTriangle size={10} />}
          {isOutage && <AlertTriangle size={10} />}
          {isMaintenance && <Wrench size={10} />}
          {status.overallStatus.replace('_', ' ')}
        </div>
      </div>

      {/* UPTIME RING */}
      <UptimeRing uptimePct={status.uptimePct15d} />

      {/* SPARKLINE */}
      <UptimeSparkline data={status.uptimeHistory} color={vendorConfig.accentColor} />

      {/* 15-DAY STATUS GRID */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-1.5 px-0.5">
          <span className="text-[9px] font-spacemono text-text-muted uppercase tracking-widest opacity-60">System History</span>
          <span className="text-[9px] font-spacemono text-text-muted uppercase tracking-widest opacity-60">Today</span>
        </div>
        <div className="flex gap-[2px] h-4">
          {Array.from({ length: 15 }).map((_, i) => {
            // Data is ordered ASC, so 14 is today, 13 is yesterday, etc.
            const day = status.uptimeHistory[i];
            const isToday = i === 14;
            
            let bgColor = "bg-white/5";
            let shadow = "";
            
            if (day) {
              if (day.uptimePct >= 99.9) {
                bgColor = "bg-green-500/50";
                shadow = "0 0 5px rgba(34,197,94,0.1)";
              } else if (day.uptimePct >= 95) {
                bgColor = "bg-yellow-500/50";
                shadow = "0 0 5px rgba(234,179,8,0.1)";
              } else {
                bgColor = "bg-red-500/70";
                shadow = "0 0 8px rgba(239,68,68,0.3)";
              }
            }

            return (
              <div
                key={i}
                title={day ? `${day.date}: ${day.uptimePct}%` : "Calculating..."}
                className={`flex-1 rounded-sm transition-all duration-300 ${bgColor} ${isToday ? "ring-1 ring-white/30" : ""}`}
                style={{ boxShadow: shadow }}
              />
            );
          })}
        </div>
      </div>

      {/* COMPONENT STATUS LIST */}
      <div className="mt-4 space-y-1">
        <div className="text-[9px] font-spacemono text-text-muted mb-2 uppercase tracking-widest opacity-80 border-b border-grid-line pb-1">
          {isOperational ? "AVAILABLE REGIONS" : "AFFECTED REGIONS"}
        </div>
        {(() => {
          const displayComponents = isOperational 
            ? status.components 
            : status.components.filter(c => c.status !== 'operational');
            
          const visibleComponents = displayComponents.slice(0, 3);
          const hiddenCount = displayComponents.length - 3;

          return (
            <>
              {visibleComponents.map(comp => (
                <div key={comp.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-1.5 h-1.5 rounded-full shadow-[0_0_4px_currentColor]"
                      style={{ 
                        color: comp.status === 'operational' ? 'var(--accent-success)' : 
                               comp.status.includes('outage') ? 'var(--accent-danger)' : 'var(--accent-warn)',
                        backgroundColor: 'currentColor'
                      }}
                    />
                    <span className="text-text-primary font-dmsans truncate max-w-[150px]">{comp.name}</span>
                  </div>
                  <span className="font-spacemono text-[10px] text-text-muted">
                    {comp.status === 'operational' ? '100%' : `${comp.uptimePct}%`}
                  </span>
                </div>
              ))}
              {hiddenCount > 0 && (
                <div className="text-[10px] text-text-muted font-spacemono text-center pt-2 opacity-70">
                  + {hiddenCount} more {isOperational ? 'systems' : 'affected'}
                </div>
              )}
              {displayComponents.length === 0 && !isOperational && (
                 <div className="text-[10px] text-text-muted font-spacemono text-center pt-2 opacity-70">
                    Check details for affected systems
                 </div>
              )}
            </>
          );
        })()}
      </div>

      {/* FOOTER ROW */}
      <div className="mt-5 pt-3 border-t border-grid-line flex items-center justify-between">
        {status.activeIncidents.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-accent-danger cursor-pointer hover:underline" style={{ textShadow: "0 0 5px var(--accent-danger)" }}>
            <AlertTriangle size={12} className="animate-pulse" />
            {status.activeIncidents.length} ACTIVE INCIDENT(S)
          </div>
        ) : status.scheduledMaintenances.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-accent-secondary">
            <Wrench size={12} />
            MAINTENANCE
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-accent-success">
            <CheckCircle size={12} />
            NO INCIDENTS
          </div>
        )}
        
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1 text-[9px] text-text-muted font-spacemono">
            <Clock size={9} />
            <span>Updated {lastUpdated}</span>
          </div>
          <div className="text-[8px] text-text-muted/60 font-spacemono uppercase">
            Data Source: Database
          </div>
        </div>
      </div>
    </motion.div>
  );
};
