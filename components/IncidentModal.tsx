"use client";

import { motion, AnimatePresence } from "framer-motion";
import { VendorStatus } from "@/types/status";
import { AlertTriangle, X, ExternalLink, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { VENDORS } from "@/lib/vendors";

interface IncidentModalProps {
  status: VendorStatus | null;
  isOpen: boolean;
  onClose: () => void;
}

export const IncidentModal = ({ status, isOpen, onClose }: IncidentModalProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!status) return null;

  const vendorConfig = VENDORS.find(v => v.id === status.vendorId);
  const activeIncident = status.activeIncidents[0]; // For simplicity, we show the first active incident

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-surface border border-accent-danger shadow-[0_0_30px_rgba(255,43,94,0.3)] rounded-xl overflow-hidden scanlines"
          >
            {/* Corner decorations */}
            <svg className="absolute top-0 left-0 w-8 h-8 pointer-events-none text-accent-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M2 10V2h8" />
            </svg>
            <svg className="absolute top-0 right-0 w-8 h-8 pointer-events-none text-accent-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M22 10V2h-8" />
            </svg>
            <svg className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none text-accent-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M2 14v8h8" />
            </svg>
            <svg className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none text-accent-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M22 14v8h-8" />
            </svg>

            {/* HEADER */}
            <div className="p-6 border-b border-grid-line bg-card flex items-start justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-accent-danger/20 rounded-full border border-accent-danger/50 shadow-[0_0_15px_var(--accent-danger)]">
                  <AlertTriangle className="text-accent-danger animate-[spin_3s_linear_infinite]" size={24} />
                </div>
                <div>
                  <h2 className="font-orbitron text-xl font-bold tracking-wider uppercase text-accent-danger" style={{ textShadow: "0 0 10px var(--accent-danger)" }}>
                    ⚠ INCIDENT ALERT
                  </h2>
                  <p className="font-spacemono text-sm text-text-primary">
                    {vendorConfig?.name || "System"}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-text-muted hover:text-text-primary transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* BODY */}
            <div className="p-6 max-h-[60vh] overflow-y-auto relative z-10">
              {activeIncident ? (
                <>
                  <h3 className="text-lg font-bold text-text-primary font-dmsans mb-2">
                    {activeIncident.title}
                  </h3>
                  
                  <div className="flex gap-4 mb-6">
                    <span className="px-2 py-1 bg-accent-danger/20 border border-accent-danger text-accent-danger text-xs font-bold uppercase tracking-wider rounded">
                      {activeIncident.severity}
                    </span>
                    <span className="px-2 py-1 bg-surface border border-border-glow text-text-muted text-xs font-spacemono flex items-center gap-1 rounded">
                      <Activity size={12} />
                      Started: {formatDistanceToNow(new Date(activeIncident.startedAt), { addSuffix: true })}
                    </span>
                  </div>

                  {activeIncident.affectedComponents?.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-orbitron text-xs text-text-muted uppercase mb-2">Affected Systems</h4>
                      <div className="flex flex-wrap gap-2">
                        {activeIncident.affectedComponents.map((comp, i) => (
                          <span key={i} className="px-2 py-1 bg-surface border border-grid-line rounded text-xs text-text-primary font-dmsans flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-warn" />
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative border-l border-dashed border-grid-line ml-3 pl-6 space-y-6">
                    {activeIncident.updates.map((update, i) => (
                      <div key={i} className="relative">
                        {i === 0 && (
                          <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-accent-danger animate-ping" />
                        )}
                        <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-accent-danger border border-surface" />
                        
                        <div className="font-spacemono text-xs text-text-muted mb-1 flex justify-between">
                          <span>{new Date(update.timestamp).toLocaleString()}</span>
                          <span className="uppercase text-accent-primary">{update.status}</span>
                        </div>
                        <p className="text-sm text-text-primary font-dmsans whitespace-pre-wrap">
                          {update.message}
                        </p>
                      </div>
                    ))}
                  </div>

                  {activeIncident.url && (
                    <div className="mt-8">
                      <a 
                        href={activeIncident.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-orbitron text-accent-primary hover:text-text-primary transition-colors hover:underline"
                      >
                        VIEW FULL INCIDENT REPORT <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-text-muted font-spacemono py-8">
                  No active incidents. You are viewing detailed status.
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="bg-card p-4 border-t border-grid-line flex flex-col items-center justify-center relative z-10 overflow-hidden">
              <div className="font-spacemono text-xs text-text-muted mb-2 tracking-widest uppercase">
                Monitoring Active — Auto-refresh in 60s
              </div>
              <div className="w-full h-1 bg-surface rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-accent-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 60, ease: "linear", repeat: Infinity }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
