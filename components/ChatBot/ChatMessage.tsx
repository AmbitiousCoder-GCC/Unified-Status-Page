// components/ChatBot/ChatMessage.tsx
'use client';

import { clsx } from 'clsx';
import type { BotMessage } from '@/types/bot';

interface Props {
  message: BotMessage;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <div className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
