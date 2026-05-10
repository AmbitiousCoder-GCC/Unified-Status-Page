"use client";

import { useStatusStore } from "@/lib/store";
import { Search, Filter, ArrowUpDown, Download } from "lucide-react";
import { VENDORS } from "@/lib/vendors";
import { VendorStatus } from "@/types/status";

export const ControlsBar = ({ statuses }: { statuses: VendorStatus[] }) => {
  const { 
    searchQuery, setSearchQuery, 
    filterMode, setFilterMode, 
    sortBy, setSortBy 
  } = useStatusStore();

  const handleExport = () => {
    if (!statuses || statuses.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(statuses, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `status_export_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 mt-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 glass-card rounded-lg relative z-20">
        
        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search vendors..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-grid-line rounded-md pl-9 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors font-dmsans"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-grid-line overflow-x-auto w-full md:w-auto">
          {["ALL", "OPERATIONAL", "DEGRADED", "OUTAGE"].map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode as any)}
              className={`px-3 py-1.5 text-xs font-orbitron rounded transition-colors whitespace-nowrap ${filterMode === mode ? 'bg-accent-primary text-surface' : 'text-text-muted hover:text-text-primary'}`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Sort & Export */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 text-text-muted">
            <ArrowUpDown size={14} />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-sm font-spacemono focus:outline-none cursor-pointer"
            >
              <option value="severity">Severity</option>
              <option value="uptime">Uptime %</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>
          
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-grid-line rounded text-xs font-spacemono text-text-primary hover:bg-surface transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
