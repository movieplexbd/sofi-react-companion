import { useRef, useEffect, useMemo, useCallback } from 'react';
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.text.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const dateGroups = useMemo(() => {
    const groups: Array<{ date: string; messages: Message[] }> = [];
    let currentDate = '';
    filteredMessages.forEach(msg => {
      const d = msg.timestamp.toLocaleDateString('bn-BD', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });
    return groups;
  }, [filteredMessages]);

  const getLastUserQ = useCallback((idx: number): string | null => {
    for (let i = idx - 1; i >= 0; i--) {
      if (filteredMessages[i].sender === 'user') return filteredMessages[i].text;
    }
    return null;
  }, [filteredMessages]);

  return (
    <div
      className="flex-1 py-2 overflow-y-auto flex flex-col wa-wallpaper scroll-smooth"
      style={{ scrollbarWidth: 'thin' }}
    >
      {dateGroups.map((group, gi) => (
        <div key={gi}>
          {/* WhatsApp-style date chip */}
          <div className="flex justify-center my-2">
            <span className="px-3 py-0.5 rounded-lg text-[0.7rem] text-muted-foreground bg-card/80 shadow-sm backdrop-blur-sm">
              {group.date}
            </span>
          </div>

          {group.messages.map((msg) => {
            const globalIdx = filteredMessages.indexOf(msg);
            const hasExtra = extraMessages.has(msg.id);

            return (
              <MessageBubble
                key={msg.id}
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
            );
          })}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
