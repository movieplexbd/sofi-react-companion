import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import type { Message } from '../../types/sofia';
import type { Lang } from '../../constants/i18n';

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onFeedback: (key: string, isPositive: boolean, userQ?: string) => void;
  onReaction: (msgId: string, emoji: string) => void;
  onRetry: (text: string) => void;
  lowConfThreshold: number;
  highConfThreshold: number;
  lang: Lang;
  searchQuery: string;
  extraMessages: Map<string, Message>;
  onReadMore: (msgId: string) => void;
}

export default function ChatBox({
  messages, onSendMessage, onFeedback, onReaction,
  onRetry, lowConfThreshold, highConfThreshold, lang,
  searchQuery, extraMessages, onReadMore,
}: ChatBoxProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.text.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  // Group messages into date sections
  const dateGroups = useMemo(() => {
    const groups: Array<{ date: string; messages: Message[] }> = [];
    let currentDate = '';
    filteredMessages.forEach(msg => {
      const d = msg.timestamp.toLocaleDateString('bn-BD', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });
    return groups;
  }, [filteredMessages]);

  // Find last user question for each bot message
  const getLastUserQ = useCallback((idx: number): string | null => {
    for (let i = idx - 1; i >= 0; i--) {
      if (filteredMessages[i].sender === 'user') return filteredMessages[i].text;
    }
    return null;
  }, [filteredMessages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 px-3 py-3 overflow-y-auto flex flex-col bg-background scroll-smooth"
      style={{ scrollbarWidth: 'thin' }}
    >
      {dateGroups.map((group, gi) => (
        <div key={gi}>
          {/* Date divider */}
          <div className="flex items-center gap-2 text-[0.72em] text-muted-foreground my-2">
            <span className="flex-1 h-px bg-border" />
            {group.date}
            <span className="flex-1 h-px bg-border" />
          </div>

          {group.messages.map((msg, mi) => {
            const globalIdx = filteredMessages.indexOf(msg);
            const hasExtra = extraMessages.has(msg.id);

            // Thread indicator - connect Q&A pairs
            const isPartOfThread = msg.threadId &&
              (mi > 0 && group.messages[mi - 1]?.threadId === msg.threadId);

            return (
              <div key={msg.id} className={isPartOfThread ? 'border-l-2 border-primary/20 ml-5 pl-2' : ''}>
                <MessageBubble
                  message={msg}
                  onSendMessage={onSendMessage}
                  onFeedback={onFeedback}
                  onReaction={onReaction}
                  onRetry={onRetry}
                  lowConfThreshold={lowConfThreshold}
                  highConfThreshold={highConfThreshold}
                  lang={lang}
                  lastUserQ={getLastUserQ(globalIdx)}
                  hasExtra={hasExtra}
                  onReadMore={hasExtra ? () => onReadMore(msg.id) : undefined}
                />
              </div>
            );
          })}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
