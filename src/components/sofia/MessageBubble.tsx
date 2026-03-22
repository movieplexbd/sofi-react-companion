import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useState, useCallback, type MouseEvent } from 'react';
import { FaThumbsUp, FaThumbsDown, FaBolt, FaChevronRight, FaRotateRight } from 'react-icons/fa6';
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
  const [showTimestamp, setShowTimestamp] = useState(false);

  const isBot = message.sender === 'bot';
  const score = message.score;
  const method = message.method;

  const confClass = !score || score === 100 ? '' :
    score >= highConfThreshold ? 'text-sofia-green bg-sofia-green/10' :
    score >= lowConfThreshold ? 'text-sofia-orange bg-sofia-orange/10' :
    'text-sofia-red bg-sofia-red/10';

  const confLabel = !score || score === 100 || !method ? '' :
    score >= highConfThreshold ? t('confirmed', lang) :
    score >= lowConfThreshold ? t('probable', lang) :
    t('guess', lang);

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
  const isLowConfidence = score != null && score < lowConfThreshold && score > 0;

  return (
    <div
      className={`flex mb-3.5 items-end animate-fade-up ${isBot ? 'justify-start' : 'justify-end'}`}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Bot avatar */}
      {isBot && (
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 mx-2 self-end border-2 border-card"
          style={{
            backgroundImage: `url('https://i.ibb.co/k2FY0LVF/1748861093385.jpg')`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            order: -1,
          }}
        />
      )}

      <div className={`flex flex-col max-w-[80%] ${isBot ? '' : 'items-end'}`}>
        {/* Spell correction banner */}
        {isBot && message.spellCorrected && message.originalText && (
          <div className="text-[0.72em] text-muted-foreground ml-0 italic mb-1 px-2 py-1 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            🔤 {t('spellCorrect', lang)} <em>"{message.originalText}"</em>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-lg break-words leading-relaxed text-[0.96em] mb-1 ${
            isBot
              ? 'bg-card text-card-foreground border border-border/30 rounded-bl-[5px]'
              : 'text-primary-foreground rounded-br-[5px]'
          }`}
          style={!isBot ? {
            background: 'var(--user-bubble-gradient)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          } : {
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}
        >
          {isBot ? (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-primary prose-strong:text-primary prose-em:text-accent prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#2d1b69] prose-pre:text-[#e8d5ff] prose-blockquote:border-accent prose-blockquote:text-muted-foreground">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{message.text}</ReactMarkdown>
            </div>
          ) : (
            <p>{message.text}</p>
          )}
        </div>

        {/* Confidence meter */}
        {isBot && score != null && score > 0 && score < 100 && method && (
          <div className="ml-0 mb-1 w-full max-w-[200px]">
            <div className="h-1 rounded-full overflow-hidden bg-border">
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

        {/* Meta row */}
        <div className={`flex items-center gap-1.5 text-[0.7em] text-muted-foreground flex-wrap ${isBot ? 'ml-0' : 'justify-end'}`}>
          {method && (
            <span className="px-2 py-0.5 rounded-lg font-semibold text-[0.85em] bg-primary/10 text-primary flex items-center gap-1">
              <FaBolt size={8} /> {method}
            </span>
          )}
          {confLabel && (
            <span className={`px-2 py-0.5 rounded-lg font-semibold text-[0.85em] ${confClass}`}>
              {confLabel} {score}%
            </span>
          )}
          {message.sentiment && message.sentiment !== 'neutral' && (
            <span className="px-2 py-0.5 rounded-lg text-[0.82em]">
              {message.sentiment === 'negative' ? '😔' : message.sentiment === 'positive' ? '😊' : message.sentiment === 'urgent' ? '⚡' : '🤔'}
            </span>
          )}
          <span className={`transition-opacity duration-200 ${showTimestamp ? 'opacity-100' : 'opacity-60'}`}>{time}</span>
        </div>

        {/* Reactions display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-1">
            {message.reactions.map((r, i) => (
              <span key={i} className="text-sm bg-card border border-border rounded-full px-1.5 py-0.5">{r}</span>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && (
          <div className="flex gap-1 mt-1 p-1.5 bg-card border border-border rounded-xl shadow-lg animate-fade-up">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReaction(message.id, emoji); setShowReactions(false); }}
                className="text-lg hover:scale-125 transition-transform active:scale-95 px-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Feedback row */}
        {isBot && message.firebaseKey && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <button
              onClick={() => handleFeedback(true)}
              className={`transition-all hover:text-sofia-green hover:scale-125 active:scale-95 ${feedbackGiven === 'pos' ? 'text-sofia-green pointer-events-none' : ''} ${feedbackGiven ? 'pointer-events-none' : ''}`}
            >
              <FaThumbsUp size={12} />
            </button>
            <button
              onClick={() => handleFeedback(false)}
              className={`transition-all hover:text-sofia-red hover:scale-125 active:scale-95 ${feedbackGiven === 'neg' ? 'text-sofia-red pointer-events-none' : ''} ${feedbackGiven ? 'pointer-events-none' : ''}`}
            >
              <FaThumbsDown size={12} />
            </button>
            <span className="text-[0.78em]">{t('helpful', lang)}</span>
          </div>
        )}

        {/* Retry button for low confidence */}
        {isBot && isLowConfidence && onRetry && lastUserQ && (
          <button
            onClick={() => onRetry(lastUserQ)}
            className="flex items-center gap-1.5 mt-1 px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-all active:scale-95"
          >
            <FaRotateRight size={10} /> {t('retry', lang)}
          </button>
        )}

        {/* Quick replies */}
        {message.quickReplies && message.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => onSendMessage(qr)}
                className="px-3 py-1 rounded-2xl border-[1.5px] border-primary/30 bg-card text-primary font-semibold text-xs hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        {/* Read more button */}
        {hasExtra && onReadMore && (
          <button
            onClick={onReadMore}
            className="mt-2 px-3 py-1 text-xs font-semibold text-primary bg-card border border-primary/30 rounded-2xl hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
          >
            {t('readMore', lang)}
          </button>
        )}

        {/* Related questions */}
        {message.related && message.related.length > 0 && (
          <div className="mt-2 p-2.5 rounded-lg border border-primary/12" style={{ background: 'hsl(var(--primary) / 0.04)' }}>
            <div className="text-[0.72em] text-muted-foreground font-semibold mb-1.5">{t('relatedQ', lang)}</div>
            {message.related.map((r, i) => (
              <button
                key={i}
                onClick={() => onSendMessage(r)}
                className="flex items-center gap-1.5 text-xs text-primary py-0.5 hover:underline w-full text-left"
              >
                <FaChevronRight size={8} /> {r}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
