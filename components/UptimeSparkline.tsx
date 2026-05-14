"use client";

import { AreaChart, Area, ResponsiveContainer, Tooltip, CartesianGrid, YAxis } from "recharts";
import { DayUptime } from "@/types/status";
import { motion } from "framer-motion";

export const UptimeSparkline = ({ 
  data, 
  color 
}: { 
  data: DayUptime[], 
  color: string 
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="h-[60px] w-full mt-4"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`color-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
            <filter id={`glow-${color.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="currentColor" vertical={false} opacity={0.05} />
          <YAxis domain={['dataMin - 0.2', 'dataMax + 0.2']} hide />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-card border border-border-glow px-2 py-1 text-xs rounded text-text-primary shadow-[0_0_10px_var(--border-glow)] font-spacemono z-50">
                    <div>{payload[0].payload.date}</div>
                    <div style={{ color }}>{Number(payload[0].value).toFixed(2)}%</div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area 
            type="basis" 
            dataKey="uptimePct" 
            stroke={color} 
            strokeWidth={1.5}
            fillOpacity={1} 
            fill={`url(#color-${color.replace('#', '')})`} 
            filter={`url(#glow-${color.replace('#', '')})`}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};
