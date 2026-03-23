import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useState, useCallback, type MouseEvent } from 'react';
import { FaThumbsUp, FaThumbsDown, FaRotateRight, FaChevronRight, FaCheck, FaCheckDouble } from 'react-icons/fa6';
import type { Message } from '../../types/sofia';
import type { Lang } from '../../constants/i18n';
import { t } from '../../constants/i18n';

interface MessageBubbleProps {
  message: Message;
  onSendMessage: (text: string) => void;
  onFeedback: (key: string, isPositive: boolean, userQ?: string) => void;
  onReaction: (msgId: string, emoji: string) => void;
  onRetry?: (text: string) => void;
  lowConfThreshold: number;
  highConfThreshold: number;
  lang: Lang;
  lastUserQ?: string | null;
  onReadMore?: () => void;
  hasExtra?: boolean;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

export default function MessageBubble({
  message, onSendMessage, onFeedback, onReaction,
  onRetry, lowConfThreshold, highConfThreshold, lang,
  lastUserQ, onReadMore, hasExtra,
}: MessageBubbleProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<'pos' | 'neg' | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  const isBot = message.sender === 'bot';
  const score = message.score;
  const method = message.method;
  const isLowConfidence = score != null && score < lowConfThreshold && score > 0;

  const handleFeedback = useCallback((positive: boolean) => {
    if (feedbackGiven || !message.firebaseKey) return;
    setFeedbackGiven(positive ? 'pos' : 'neg');
    onFeedback(message.firebaseKey, positive, lastUserQ || undefined);
  }, [feedbackGiven, message.firebaseKey, onFeedback, lastUserQ]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setShowReactions(prev => !prev);
  }, []);

  const time = message.timestamp.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`flex mb-1.5 px-2 ${isBot ? 'justify-start' : 'justify-end'}`}
      onContextMenu={handleContextMenu}
    >
      {/* Bot avatar - small */}
      {isBot && (
        <div
          className="w-0 h-0 flex-shrink-0"
          style={{ order: -1 }}
        />
      )}

      <div className={`flex flex-col max-w-[85%] ${isBot ? '' : 'items-end'}`}>
        {/* Spell correction banner */}
        {isBot && message.spellCorrected && message.originalText && (
          <div className="text-[0.7em] text-muted-foreground italic mb-1 px-2 py-0.5 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 ml-1">
            🔤 {t('spellCorrect', lang)} <em>"{message.originalText}"</em>
          </div>
        )}

        {/* WhatsApp-style bubble with tail */}
        <div
          className={`relative px-3 py-1.5 break-words leading-relaxed text-[0.9rem] ${
            isBot
              ? 'bg-card text-card-foreground rounded-lg rounded-tl-sm'
              : 'text-primary-foreground rounded-lg rounded-tr-sm'
          }`}
          style={{
            background: isBot ? undefined : 'hsl(var(--user-bubble))',
            boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
          }}
        >
          {isBot ? (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:text-primary prose-headings:my-2 prose-strong:text-primary prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em]">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{message.text}</ReactMarkdown>
            </div>
          ) : (
            <p className="my-0">{message.text}</p>
          )}

          {/* Bottom row: meta + time + ticks */}
          <div className={`flex items-center gap-1 mt-0.5 -mb-0.5 ${isBot ? '' : 'justify-end'}`}>
            {method && (
              <span className="text-[0.6rem] px-1 py-0 rounded font-medium opacity-60">
                {method}
              </span>
            )}
            {score != null && score > 0 && score < 100 && (
              <span className={`text-[0.6rem] font-medium ${
                score >= highConfThreshold ? 'text-green-600 dark:text-green-400' :
                score >= lowConfThreshold ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-500'
              }`}>
                {score}%
              </span>
            )}
            <span className={`text-[0.65rem] ml-auto ${isBot ? 'text-muted-foreground' : 'text-white/70'}`}>
              {time}
            </span>
            {!isBot && (
              <FaCheckDouble size={12} className="text-blue-300 ml-0.5" />
            )}
          </div>
        </div>

        {/* Confidence bar (subtle) */}
        {isBot && score != null && score > 0 && score < 100 && method && (
          <div className="ml-1 mt-0.5 w-full max-w-[160px]">
            <div className="h-[2px] rounded-full overflow-hidden bg-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: score >= highConfThreshold ? 'hsl(var(--sofia-green))' :
                    score >= lowConfThreshold ? 'hsl(var(--sofia-orange))' :
                    'hsl(var(--sofia-red))',
                }}
              />
            </div>
          </div>
        )}

        {/* Reactions display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-0.5 mt-0.5 ml-1">
            {message.reactions.map((r, i) => (
              <span key={i} className="text-xs bg-card border border-border rounded-full px-1 py-0">{r}</span>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && (
          <div className="flex gap-1 mt-1 p-1 bg-card border border-border rounded-xl shadow-lg animate-fade-up">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReaction(message.id, emoji); setShowReactions(false); }}
                className="text-base hover:scale-125 transition-transform active:scale-95 px-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Feedback row */}
        {isBot && message.firebaseKey && (
          <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground mt-0.5 ml-1">
            <button
              onClick={() => handleFeedback(true)}
              className={`transition-all hover:text-green-600 hover:scale-110 active:scale-95 ${feedbackGiven === 'pos' ? 'text-green-600 pointer-events-none' : ''} ${feedbackGiven ? 'pointer-events-none' : ''}`}
            >
              <FaThumbsUp size={10} />
            </button>
            <button
              onClick={() => handleFeedback(false)}
              className={`transition-all hover:text-red-500 hover:scale-110 active:scale-95 ${feedbackGiven === 'neg' ? 'text-red-500 pointer-events-none' : ''} ${feedbackGiven ? 'pointer-events-none' : ''}`}
            >
              <FaThumbsDown size={10} />
            </button>
          </div>
        )}

        {/* Retry button */}
        {isBot && isLowConfidence && onRetry && lastUserQ && (
          <button
            onClick={() => onRetry(lastUserQ)}
            className="flex items-center gap-1 mt-1 ml-1 px-2.5 py-0.5 text-[0.7rem] font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-all active:scale-95"
          >
            <FaRotateRight size={9} /> {t('retry', lang)}
          </button>
        )}

        {/* Quick replies */}
        {message.quickReplies && message.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
            {message.quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => onSendMessage(qr)}
                className="px-2.5 py-1 rounded-full border border-primary/30 bg-card text-primary font-medium text-[0.75rem] hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        {/* Read more */}
        {hasExtra && onReadMore && (
          <button
            onClick={onReadMore}
            className="mt-1 ml-1 px-2.5 py-0.5 text-[0.75rem] font-medium text-primary bg-card border border-primary/30 rounded-full hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
          >
            {t('readMore', lang)}
          </button>
        )}

        {/* Related questions */}
        {message.related && message.related.length > 0 && (
          <div className="mt-1.5 ml-1 p-2 rounded-lg border border-primary/10 bg-primary/5">
            <div className="text-[0.65rem] text-muted-foreground font-semibold mb-1">{t('relatedQ', lang)}</div>
            {message.related.map((r, i) => (
              <button
                key={i}
                onClick={() => onSendMessage(r)}
                className="flex items-center gap-1 text-[0.75rem] text-primary py-0.5 hover:underline w-full text-left"
              >
                <FaChevronRight size={7} /> {r}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
