import { PERSONALITIES } from '../../constants/personalities';

interface TypingIndicatorProps {
  visible: boolean;
  personality: string;
}

export default function TypingIndicator({ visible, personality }: TypingIndicatorProps) {
  if (!visible) return null;
  const p = PERSONALITIES[personality] || PERSONALITIES.friendly;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0 wa-wallpaper">
      <div className="bg-card rounded-lg rounded-tl-sm px-3 py-2 shadow-sm flex items-center gap-2">
        <div className="flex gap-0.5 items-center">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-[6px] h-[6px] bg-muted-foreground rounded-full animate-tdot"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <span className="text-[0.7rem] text-muted-foreground">{p.typingMsg}</span>
      </div>
    </div>
  );
}
