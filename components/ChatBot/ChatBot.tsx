// components/ChatBot/ChatBot.tsx
'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { MessageCircle, X, Send, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { ChatMessage } from './ChatMessage';
import { useChatBot } from './useChatBot';
import { motion, AnimatePresence } from 'framer-motion';

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, clearChat } = useChatBot();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const SUGGESTED = [
    'Is GitHub down right now?',
    'Any active outages?',
    'Snowflake incidents last week',
    'Which vendor had the most incidents?',
  ];

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? 'Close status bot' : 'Open status bot'}
        className={clsx(
          'fixed bottom-6 right-6 z-50 flex h-14 px-6 items-center justify-center',
          'rounded-full shadow-[0_0_20px_var(--accent-primary)] transition-all duration-300',
          'bg-[var(--accent-primary)] hover:bg-[#00cccc] text-black border-2 border-transparent hover:border-white/50',
          isOpen && 'scale-90 opacity-70'
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <span className="font-orbitron font-bold tracking-widest text-lg">NEXUS</span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0.01, scaleX: 0.8, transformOrigin: "bottom center" }}
            animate={{ opacity: 1, scaleY: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleY: 0.01, scaleX: 0.8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              'fixed bottom-24 right-6 z-50 flex flex-col',
            'w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)]',
            'rounded-none border border-[var(--border-glow)] overflow-hidden',
            'hologram-window animate-[hologram_4s_infinite_alternate]'
          )}
        >
          {/* Internal Scanline Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_51%)] bg-[length:100%_4px] z-0" />
          <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_bottom,transparent,var(--accent-primary),transparent)] bg-[length:100%_100%] animate-[scanline_8s_linear_infinite] z-0" />
          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--border-glow)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-none shrink-0 shadow-[0_4px_20px_rgba(6,182,212,0.1)]">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 animate-[hud-pulse_3s_infinite]" />
              <span className="font-orbitron font-bold tracking-widest text-sm text-[var(--text-primary)]" style={{ textShadow: '0 0 8px var(--accent-primary)' }}>NEXUS</span>
              <span className="text-[10px] font-spacemono border border-[var(--accent-primary)] rounded px-1.5 py-0.5 ml-1 text-[var(--accent-primary)] bg-[var(--accent-primary)]/10">SYS.ONLINE</span>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat"
              className="text-[var(--accent-primary)]/70 hover:text-[var(--accent-primary)] transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-[var(--accent-primary)] scrollbar-track-transparent">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (shown when only the welcome message is present) */}
          {messages.length === 1 && (
            <div className="relative z-10 px-4 pb-2 flex flex-wrap gap-2 shrink-0">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => { sendMessage(s); }}
                  className="font-spacemono text-[10px] border border-[var(--border-glow)] bg-[var(--bg-surface)]/50 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] rounded-none px-3 py-1.5 transition-all duration-300 hover:shadow-[0_0_10px_var(--border-glow)]"
                >
                  &gt; {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="relative z-10 px-3 pb-3 pt-2 border-t border-[var(--border-glow)] shrink-0 bg-[var(--bg-surface)]/30">
            <div className="flex items-end gap-2 bg-[var(--bg-base)]/50 border border-[var(--border-glow)] rounded-none px-3 py-2 focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_10px_var(--border-glow)] transition-all">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about vendor status..."
                disabled={isLoading}
                className={clsx(
                  'flex-1 resize-none bg-transparent font-spacemono text-[11px] text-[var(--text-primary)]',
                  'placeholder-[var(--text-muted)] focus:outline-none max-h-28 overflow-y-auto',
                  'disabled:opacity-50'
                )}
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-none transition-colors shrink-0 border',
                  input.trim() && !isLoading
                    ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-black shadow-[0_0_10px_var(--accent-primary)]'
                    : 'bg-transparent border-transparent text-[var(--text-muted)] cursor-not-allowed'
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--accent-primary)] animate-pulse rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-[var(--accent-primary)] animate-pulse rounded-full" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-1.5 bg-[var(--accent-primary)] animate-pulse rounded-full" style={{ animationDelay: '0.4s' }}></span>
              </div>
              <p className="font-spacemono text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
                SECURE UPLINK ESTABLISHED
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
