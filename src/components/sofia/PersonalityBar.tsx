import { PERSONALITIES } from '../../constants/personalities';

interface PersonalityBarProps {
  active: string;
  onSelect: (key: string) => void;
}

export default function PersonalityBar({ active, onSelect }: PersonalityBarProps) {
  return (
    <div className="flex gap-1.5 px-3.5 py-2 border-b border-primary/10 flex-shrink-0 overflow-x-auto scrollbar-thin" style={{ background: 'hsl(var(--primary) / 0.06)' }}>
      {Object.entries(PERSONALITIES).map(([key, p]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap border-[1.5px] transition-all duration-200 active:scale-95 ${
            active === key
              ? 'bg-primary text-primary-foreground border-transparent'
              : 'bg-transparent text-primary border-primary/25 hover:bg-primary/10'
          }`}
        >
          {p.emoji} {p.label}
        </button>
      ))}
    </div>
  );
}
