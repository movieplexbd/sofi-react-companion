import { PERSONALITIES } from '../../constants/personalities';

interface TypingIndicatorProps {
  visible: boolean;
  personality: string;
}

export default function TypingIndicator({ visible, personality }: TypingIndicatorProps) {
  if (!visible) return null;
  const p = PERSONALITIES[personality] || PERSONALITIES.friendly;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 border-t border-border/30 flex-shrink-0" style={{ background: 'hsl(var(--background))' }}>
      <div
        className="w-7 h-7 rounded-full border border-card"
        style={{
          backgroundImage: `url('https://i.ibb.co/k2FY0LVF/1748861093385.jpg')`,
          backgroundSize: 'cover',
        }}
      />
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-[7px] h-[7px] bg-primary rounded-full animate-tdot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground italic">{p.typingMsg}</span>
    </div>
  );
}
