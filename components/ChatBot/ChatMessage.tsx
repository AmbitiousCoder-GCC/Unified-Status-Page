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
  return (
    <div className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[87%] rounded-2xl px-4 py-3 text-sm break-words',
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm whitespace-pre-wrap'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
        )}
      >
        {isUser ? message.content : renderMarkdown(message.content)}
      </div>
    </div>
  );
}
