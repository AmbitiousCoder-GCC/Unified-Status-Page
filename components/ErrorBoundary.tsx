"use client";

import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from "react-error-boundary";
import { AlertTriangle, RefreshCw } from "lucide-react";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border border-red-500/30 bg-red-500/5 rounded-lg text-center h-full min-h-[150px]">
      <AlertTriangle className="text-red-500 mb-2" size={24} />
      <p className="text-sm text-text-primary mb-4 font-spacemono">
        This section failed to load.
      </p>
      <button 
        onClick={resetErrorBoundary}
        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-spacemono border border-red-500/50 rounded transition-colors"
      >
        <RefreshCw size={14} />
        Retry
      </button>
      <p className="text-[10px] text-text-muted mt-4 font-mono truncate max-w-full">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
