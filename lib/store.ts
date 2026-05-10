import { create } from "zustand";

interface StatusState {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  
  filterMode: "ALL" | "OPERATIONAL" | "DEGRADED" | "OUTAGE";
  setFilterMode: (f: "ALL" | "OPERATIONAL" | "DEGRADED" | "OUTAGE") => void;
  
  sortBy: "uptime" | "alphabetical" | "severity";
  setSortBy: (s: "uptime" | "alphabetical" | "severity") => void;
}

export const useStatusStore = create<StatusState>((set) => ({
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  
  filterMode: "ALL",
  setFilterMode: (filterMode) => set({ filterMode }),
  
  sortBy: "severity",
  setSortBy: (sortBy) => set({ sortBy }),
}));
