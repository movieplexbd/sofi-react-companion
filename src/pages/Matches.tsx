import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AI_CHARACTERS } from '../data/aiCharacters';

interface Props {
  matches: string[];
  chatHistory: Record<string, { lastMsg: string; time: Date }>;
}

export default function Matches({ matches, chatHistory }: Props) {
  const navigate = useNavigate();

  const matchedChars = useMemo(() =>
    matches.map(id => AI_CHARACTERS.find(c => c.id === id)).filter(Boolean) as typeof AI_CHARACTERS,
    [matches]
  );

  if (matchedChars.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">💝</div>
        <h2 className="text-xl font-bold text-foreground mb-2">এখনো কোনো match নেই</h2>
        <p className="text-muted-foreground text-sm">Discover-এ গিয়ে profiles swipe করো!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* New matches row */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">New Matches</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {matchedChars.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/chat/${c.id}`)}
              className="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-pink-400 p-0.5">
                <img src={c.avatar} alt={c.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <span className="text-xs font-medium text-foreground">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border mx-4" />

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-3 mb-2">Messages</h3>
        {matchedChars.map(c => {
          const history = chatHistory[c.id];
          return (
            <button
              key={c.id}
              onClick={() => navigate(`/chat/${c.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left"
            >
              <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-sm">{c.name}</span>
                  {history && (
                    <span className="text-xs text-muted-foreground">
                      {history.time.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {history?.lastMsg || `${c.personality} • Tap to chat`}
                </p>
              </div>
              <div className="w-3 h-3 rounded-full bg-pink-500 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
