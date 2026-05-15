// components/ChatBot/ChatMessage.tsx
'use client';

import { clsx } from 'clsx';
import type { BotMessage } from '@/types/bot';

interface Props {
  message: BotMessage;
}

/** Converts a small subset of markdown to JSX without a full library */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line → spacer
    if (line.trim() === '') {
      nodes.push(<span key={key++} className="block h-2" />);
      continue;
    }

    // Render inline bold (**text**) within a line
    const renderInline = (raw: string): React.ReactNode => {
      const parts = raw.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    // Bullet list item
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      nodes.push(
        <div key={key++} className="flex gap-2 items-start my-0.5">
          <span className="shrink-0 mt-1 text-blue-400">•</span>
          <span>{renderInline(line.replace(/^[\s]*[-•]\s/, ''))}</span>
        </div>
      );
      continue;
    }

    // Default paragraph line
    nodes.push(
      <p key={key++} className="my-0.5 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  return nodes;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  
  const confidenceColor = 
    message.confidence === 'high' ? 'text-green-400 border-green-400/50 bg-green-400/10' :
    message.confidence === 'medium' ? 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' :
    message.confidence === 'low' ? 'text-red-400 border-red-400/50 bg-red-400/10' :
    'text-gray-400 border-gray-400/50 bg-gray-400/10';

  return (
    <div className={clsx('flex w-full flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      <div
        className={clsx(
          'max-w-[87%] rounded-none px-4 py-3 text-[13px] font-spacemono font-semibold tracking-wide break-words border',
          isUser
            ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)] shadow-[0_0_10px_rgba(6,182,212,0.2)] whitespace-pre-wrap'
            : 'bg-[var(--bg-surface)]/40 text-[var(--text-primary)] border-[var(--border-glow)] shadow-[inset_0_0_10px_rgba(6,182,212,0.05)]'
        )}
      >
        {isUser ? `> ${message.content}` : renderMarkdown(message.content)}
      </div>
      {!isUser && message.confidence && message.confidence !== 'none' && (
        <div className={clsx("text-[9px] uppercase tracking-wider border px-1.5 py-0.5 ml-1 rounded-none font-spacemono shadow-sm", confidenceColor)}>
          {message.confidence} Confidence
        </div>
      )}
    </div>
  );
}
