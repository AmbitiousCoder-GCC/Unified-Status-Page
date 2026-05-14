// components/ChatBot/ChatBot.tsx
'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { MessageCircle, X, Send, Trash2, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { ChatMessage } from './ChatMessage';
import { useChatBot } from './useChatBot';

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
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center',
          'rounded-full shadow-lg transition-all duration-200',
          'bg-blue-600 hover:bg-blue-700 text-white',
          isOpen && 'rotate-90'
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className={clsx(
            'fixed bottom-24 right-6 z-50 flex flex-col',
            'w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)]',
            'rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700',
            'bg-white dark:bg-gray-900 overflow-hidden'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-600 text-white rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold text-sm">Nexus Status Bot</span>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">AI</span>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat"
              className="text-white/70 hover:text-white transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
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
            <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => { sendMessage(s); }}
                  className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full px-3 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about vendor status..."
                disabled={isLoading}
                className={clsx(
                  'flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100',
                  'placeholder-gray-400 focus:outline-none max-h-28 overflow-y-auto',
                  'disabled:opacity-50'
                )}
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0',
                  input.trim() && !isLoading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              Powered by vendor status APIs · Data updated every 5 min
            </p>
          </div>
        </div>
      )}
    </>
  );
}
