"use client";

import { VendorStatus } from "@/types/status";
import { VendorCard } from "./VendorCard";
import { SkeletonCard } from "./SkeletonCard";
import { motion, AnimatePresence } from "framer-motion";

interface StatusGridProps {
  statuses: VendorStatus[];
  onSelectVendor: (vendorId: string) => void;
}

export const StatusGrid = ({ statuses, onSelectVendor }: StatusGridProps) => {
  if (!statuses || statuses.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(11)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8">
      <motion.div 
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        <AnimatePresence>
          {statuses.map((status, index) => (
            <VendorCard 
              key={status.vendorId} 
              status={status} 
              index={index} 
              onClick={() => onSelectVendor(status.vendorId)}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
