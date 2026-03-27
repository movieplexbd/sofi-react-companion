import { useState } from 'react';
import type { UserProfile as UserProfileType } from '../hooks/useUserPrefs';
import { FaPen, FaHeart, FaBrain, FaArrowRightFromBracket } from 'react-icons/fa6';

const INTEREST_OPTIONS = [
  '📚 বই পড়া', '🎵 গান শোনা', '🎮 গেমিং', '✈️ ভ্রমণ',
  '🍳 রান্না', '🎬 মুভি', '📸 ফটোগ্রাফি', '🏋️ ফিটনেস',
  '🎨 আঁকা', '💻 টেকনোলজি', '⚽ খেলাধুলা', '🌿 প্রকৃতি',
];

interface Props {
  profile: UserProfileType;
  onUpdate: (p: UserProfileType) => void;
  matchCount: number;
  onReset: () => void;
}

export default function UserProfile({ profile, onUpdate, matchCount, onReset }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [interests, setInterests] = useState(profile.interests);

  const handleSave = () => {
    onUpdate({ ...profile, name: name.trim() || 'বন্ধু', interests });
    setEditing(false);
  };

  const toggle = (item: string) => {
    setInterests(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header card */}
      <div className="bg-gradient-to-br from-pink-500 to-rose-500 text-white px-6 pt-8 pb-10 text-center relative">
        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mx-auto flex items-center justify-center text-3xl mb-3">
          {profile.name.charAt(0) || '👤'}
        </div>
        {editing ? (
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-white/20 backdrop-blur-sm text-white text-center rounded-lg px-4 py-2 text-lg font-semibold focus:outline-none border border-white/30"
            autoFocus
          />
        ) : (
          <h1 className="text-xl font-bold">{profile.name}</h1>
        )}
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
        >
          <FaPen size={12} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 justify-center -mt-5 px-4">
        <div className="bg-card rounded-xl shadow-lg px-5 py-3 text-center">
          <div className="text-xl font-bold text-pink-500">{matchCount}</div>
          <div className="text-xs text-muted-foreground">Matches</div>
        </div>
        <div className="bg-card rounded-xl shadow-lg px-5 py-3 text-center">
          <div className="text-xl font-bold text-pink-500">{profile.interests.length}</div>
          <div className="text-xs text-muted-foreground">Interests</div>
        </div>
        <div className="bg-card rounded-xl shadow-lg px-5 py-3 text-center">
          <div className="text-xl font-bold text-pink-500">{profile.preferredPersonality.length}</div>
          <div className="text-xs text-muted-foreground">Prefs</div>
        </div>
      </div>

      {/* Interests */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <FaHeart size={14} className="text-pink-500" /> আমার পছন্দ
        </h3>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            INTEREST_OPTIONS.map(item => (
              <button
                key={item}
                onClick={() => toggle(item)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  interests.includes(item)
                    ? 'bg-pink-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-pink-100'
                }`}
              >
                {item}
              </button>
            ))
          ) : (
            profile.interests.map(item => (
              <span key={item} className="px-3 py-1.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                {item}
              </span>
            ))
          )}
        </div>
      </div>

      {/* AI Memory Info */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
          <FaBrain size={14} className="text-purple-500" /> AI Memory
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          তোমার AI partners তোমার পছন্দ, কথোপকথনের বিষয়, এবং mood মনে রাখে। 
          এটা তাদের তোমার সাথে আরো ভালো কথা বলতে সাহায্য করে! 🧠✨
        </p>
      </div>

      {/* Reset */}
      <div className="px-4 mt-8 mb-8">
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
        >
          <FaArrowRightFromBracket size={14} />
          রিসেট করো
        </button>
      </div>
    </div>
  );
}
