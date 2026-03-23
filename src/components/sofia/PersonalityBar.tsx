import { PERSONALITIES } from '../../constants/personalities';

interface PersonalityBarProps {
  active: string;
  onSelect: (key: string) => void;
}

export default function PersonalityBar({ active, onSelect }: PersonalityBarProps) {
  return (
    <div className="flex gap-1 px-3 py-1.5 border-b border-border/10 flex-shrink-0 overflow-x-auto scrollbar-thin bg-card/50">
      {Object.entries(PERSONALITIES).map(([key, p]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={`px-2.5 py-0.5 rounded-full text-[0.7rem] font-medium whitespace-nowrap transition-all duration-200 active:scale-95 ${
            active === key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
          }`}
        >
          {p.emoji} {p.label}
        </button>
      ))}
    </div>
  );
}
