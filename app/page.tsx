"use client";

import useSWR from "swr";
import { useState, useEffect, useMemo } from "react";
import { HeroHeader } from "@/components/HeroHeader";
import { GlobalStatusBar } from "@/components/GlobalStatusBar";
import { StatusGrid } from "@/components/StatusGrid";
import { ControlsBar } from "@/components/ControlsBar";
import { IncidentModal } from "@/components/IncidentModal";

import { useStatusStore } from "@/lib/store";
import { VendorStatus } from "@/types/status";
import { VENDORS_LIST } from "@/lib/vendors";
import { AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Dashboard() {
  const { data: statuses, error } = useSWR<VendorStatus[]>('/api/aggregate', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: true,
  });

  const { searchQuery, filterMode, sortBy } = useStatusStore();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  
  // Toast notifications state
  const [toasts, setToasts] = useState<{id: string, title: string, vendor: string}[]>([]);
  const [prevIncidentIds, setPrevIncidentIds] = useState<Set<string>>(new Set());

  // Handle new incidents detection for toasts
  useEffect(() => {
    if (!statuses) return;
    
    const currentIncidentIds = new Set<string>();
    const newToasts: any[] = [];

    statuses.forEach(status => {
      status.activeIncidents.forEach(inc => {
        currentIncidentIds.add(inc.id);
        if (!prevIncidentIds.has(inc.id) && prevIncidentIds.size > 0) {
          const vendorName = VENDORS_LIST.find(v => v.id === status.vendorId)?.name || "Unknown";
          newToasts.push({ id: inc.id, title: inc.title, vendor: vendorName });
        }
      });
    });

    if (newToasts.length > 0) {
      setToasts(prev => [...prev, ...newToasts]);
      // Auto dismiss after 8s
      newToasts.forEach(t => {
        setTimeout(() => {
          setToasts(current => current.filter(toast => toast.id !== t.id));
        }, 8000);
      });
    }

    setPrevIncidentIds(currentIncidentIds);
  }, [statuses]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAndSortedStatuses = useMemo(() => {
    if (!statuses) return [];

    let result = [...statuses];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => {
        const vendor = VENDORS_LIST.find(v => v.id === s.vendorId);
        return vendor?.name.toLowerCase().includes(q) || vendor?.description.toLowerCase().includes(q);
      });
    }

    // Filter
    if (filterMode !== "ALL") {
      result = result.filter(s => {
        if (filterMode === "OPERATIONAL") return s.overallStatus === "operational";
        if (filterMode === "DEGRADED") return s.overallStatus === "degraded";
        if (filterMode === "OUTAGE") return s.overallStatus.includes("outage");
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "alphabetical") {
        const nameA = VENDORS_LIST.find(v => v.id === a.vendorId)?.name || "";
        const nameB = VENDORS_LIST.find(v => v.id === b.vendorId)?.name || "";
        return nameA.localeCompare(nameB);
      }
      if (sortBy === "uptime") {
        return a.uptimePct15d - b.uptimePct15d; // Lowest uptime first
      }
      if (sortBy === "severity") {
        const severityScore = (s: VendorStatus) => {
          if (s.overallStatus.includes("outage")) return 3;
          if (s.overallStatus === "degraded") return 2;
          if (s.overallStatus === "maintenance") return 1;
          return 0;
        };
        return severityScore(b) - severityScore(a); // Highest severity first
      }
      return 0;
    });

    return result;
  }, [statuses, searchQuery, filterMode, sortBy]);

  const selectedStatus = statuses?.find(s => s.vendorId === selectedVendorId) || null;
  const lastFetched = statuses?.[0]?.fetchedAt;

  return (
    <main className="min-h-screen pb-20">
      
      <ErrorBoundary>
        <HeroHeader lastFetched={lastFetched} />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <GlobalStatusBar statuses={statuses || []} />
      </ErrorBoundary>
      
      <ControlsBar statuses={statuses || []} />
      
      {error ? (
        <div className="w-full p-10 text-center text-accent-danger font-spacemono">
          Failed to load status data. Please try again.
        </div>
      ) : (
        <ErrorBoundary>
          <StatusGrid 
            statuses={filteredAndSortedStatuses} 
            onSelectVendor={setSelectedVendorId} 
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary>
        <IncidentModal 
          isOpen={!!selectedVendorId} 
          status={selectedStatus} 
          onClose={() => setSelectedVendorId(null)} 
        />
      </ErrorBoundary>

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card border border-accent-danger rounded p-3 shadow-[0_0_15px_rgba(255,43,94,0.4)] flex items-start gap-3 max-w-sm"
            >
              <AlertCircle className="text-accent-danger shrink-0 mt-0.5" size={16} />
              <div className="flex-1">
                <h4 className="text-xs font-bold font-orbitron text-accent-danger uppercase">⚠ New Incident: {toast.vendor}</h4>
                <p className="text-sm text-text-primary font-dmsans mt-1 line-clamp-2">{toast.title}</p>
              </div>
              <button onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))} className="text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}
