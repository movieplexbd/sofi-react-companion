import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AI_CHARACTERS, type AICharacter } from '../data/aiCharacters';
import { FaHeart, FaXmark, FaStar, FaLocationDot, FaBriefcase } from 'react-icons/fa6';

interface Props {
  matches: string[];
  onLike: (id: string) => void;
  skipped: string[];
  onSkip: (id: string) => void;
}

export default function Discover({ matches, onLike, skipped, onSkip }: Props) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const available = useMemo(() =>
    AI_CHARACTERS.filter(c => !matches.includes(c.id) && !skipped.includes(c.id)),
    [matches, skipped]
  );

  const current = available[currentIndex % Math.max(available.length, 1)] as AICharacter | undefined;

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (!current) return;
    setSwipeDir(direction);
    setTimeout(() => {
      if (direction === 'right') {
        onLike(current.id);
      } else {
        onSkip(current.id);
      }
      setSwipeDir(null);
      setShowDetails(false);
      setCurrentIndex(0);
    }, 300);
  }, [current, onLike, onSkip]);

  if (!current) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">💫</div>
        <h2 className="text-xl font-bold text-foreground mb-2">সব profiles দেখা হয়ে গেছে!</h2>
        <p className="text-muted-foreground text-sm mb-6">তোমার matches-এ গিয়ে chat শুরু করো</p>
        <button
          onClick={() => navigate('/matches')}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold shadow-lg active:scale-95 transition-transform"
        >
          💬 Matches দেখো
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 relative overflow-hidden">
      {/* Card */}
      <div
        className={`relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
          swipeDir === 'left' ? '-translate-x-[120%] -rotate-12 opacity-0' :
          swipeDir === 'right' ? 'translate-x-[120%] rotate-12 opacity-0' : ''
        }`}
        style={{ aspectRatio: '3/4.2' }}
      >
        {/* Image */}
        <img
          src={current.avatar}
          alt={current.name}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Info */}
        <div
          className="absolute bottom-0 left-0 right-0 p-4 text-white cursor-pointer"
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className="flex items-end gap-2 mb-1">
            <h2 className="text-2xl font-bold">{current.name}</h2>
            <span className="text-lg opacity-90">{current.age}</span>
            <span className="ml-auto bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs">
              AI ✨
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm opacity-80 mb-2">
            <FaBriefcase size={12} />
            <span>{current.profession}</span>
            <span className="mx-1">•</span>
            <span>{current.personality}</span>
          </div>

          {showDetails && (
            <div className="animate-fade-up">
              <p className="text-sm leading-relaxed mb-3 opacity-90">{current.bio}</p>
              <div className="flex flex-wrap gap-1.5">
                {current.interests.map(i => (
                  <span key={i} className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-xs">
                    {i}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {current.traits.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-pink-500/40 backdrop-blur-sm rounded-full text-xs">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Swipe indicators */}
        {swipeDir === 'right' && (
          <div className="absolute top-8 left-6 border-4 border-green-400 text-green-400 px-4 py-1 rounded-lg rotate-[-20deg] text-2xl font-bold">
            LIKE
          </div>
        )}
        {swipeDir === 'left' && (
          <div className="absolute top-8 right-6 border-4 border-red-400 text-red-400 px-4 py-1 rounded-lg rotate-[20deg] text-2xl font-bold">
            NOPE
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-6 mt-6">
        <button
          onClick={() => handleSwipe('left')}
          className="w-14 h-14 rounded-full bg-card border-2 border-red-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform text-red-400"
        >
          <FaXmark size={24} />
        </button>

        <button
          onClick={() => handleSwipe('right')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-xl active:scale-90 transition-transform text-white"
        >
          <FaHeart size={28} />
        </button>

        <button
          onClick={() => { onLike(current.id); navigate(`/chat/${current.id}`); }}
          className="w-14 h-14 rounded-full bg-card border-2 border-blue-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform text-blue-400"
        >
          <FaStar size={22} />
        </button>
      </div>
    </div>
  );
}
