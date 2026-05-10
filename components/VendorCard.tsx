"use client";

import { motion, useReducedMotion } from "framer-motion";
import { VendorStatus } from "@/types/status";
import { VENDORS } from "@/lib/vendors";
import { UptimeRing } from "./UptimeRing";
import { UptimeSparkline } from "./UptimeSparkline";
import { AlertTriangle, CheckCircle, Wrench, Clock } from "lucide-react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

interface VendorCardProps {
  status: VendorStatus;
  index: number;
  onClick: () => void;
}

export const VendorCard = ({ status, index, onClick }: VendorCardProps) => {
  const shouldReduceMotion = useReducedMotion();
  const vendorConfig = VENDORS.find(v => v.id === status.vendorId);
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
      className={`relative glass-card rounded-xl p-5 cursor-pointer overflow-hidden transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-accent-primary
        ${status.activeIncidents.length > 0 ? "border-[var(--accent-danger)] animate-[pulse_2s_ease-in-out_infinite]" : "border-border-glow hover:border-[var(--accent-primary)]"}`}
      style={{
        "--hover-border": vendorConfig.accentColor
      } as React.CSSProperties}
    >
      {/* Background glow using accent color */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${vendorConfig.accentColor}, transparent 70%)` }}
      />

      {/* HEADER ROW */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* We'll use a generic icon placeholder until logos are available or load actual images */}
          <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center p-1" style={{ border: `1px solid ${vendorConfig.accentColor}40` }}>
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
      <UptimeRing uptimePct={status.uptimePct30d} />

      {/* SPARKLINE */}
      <UptimeSparkline data={status.uptimeHistory} color={vendorConfig.accentColor} />

      {/* COMPONENT STATUS LIST */}
      <div className="mt-4 space-y-1">
        {status.components.slice(0, 3).map(comp => (
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
        {status.components.length > 3 && (
          <div className="text-[10px] text-text-muted font-spacemono text-center pt-1 opacity-70">
            + {status.components.length - 3} more systems
          </div>
        )}
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
        
        <div className="flex items-center gap-1 text-[9px] text-text-muted font-spacemono">
          <Clock size={9} />
          {/* To prevent hydration mismatch, we might just show "Just now" or calculate on client */}
          <span>Updated</span>
        </div>
      </div>
    </motion.div>
  );
};
