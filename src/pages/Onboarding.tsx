import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../hooks/useUserPrefs';

const INTEREST_OPTIONS = [
  '📚 বই পড়া', '🎵 গান শোনা', '🎮 গেমিং', '✈️ ভ্রমণ',
  '🍳 রান্না', '🎬 মুভি', '📸 ফটোগ্রাফি', '🏋️ ফিটনেস',
  '🎨 আঁকা', '💻 টেকনোলজি', '⚽ খেলাধুলা', '🌿 প্রকৃতি',
];

const PERSONALITY_PREFS = [
  { id: 'caring', label: '💕 যত্নশীল', desc: 'যে সবসময় তোমার খেয়াল রাখবে' },
  { id: 'funny', label: '😂 মজার', desc: 'যে তোমাকে হাসাবে' },
  { id: 'romantic', label: '🌹 রোমান্টিক', desc: 'যে ভালোবাসার কথা বলবে' },
  { id: 'intellectual', label: '🧠 বুদ্ধিমতী', desc: 'যে গভীর কথা বলবে' },
  { id: 'adventurous', label: '🔥 সাহসী', desc: 'যে adventure ভালোবাসে' },
  { id: 'shy', label: '🥺 লাজুক', desc: 'যে একটু shy কিন্তু sweet' },
];

interface Props {
  onComplete: (profile: UserProfile) => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [personalities, setPersonalities] = useState<string[]>([]);

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleFinish = () => {
    onComplete({
      name: name.trim() || 'বন্ধু',
      interests,
      preferredPersonality: personalities,
      onboarded: true,
    });
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-gradient-to-b from-rose-500 via-pink-500 to-purple-600 text-white overflow-hidden">
      {/* Progress */}
      <div className="flex gap-1.5 px-6 pt-6 pb-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: step >= i ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
        {/* Step 0: Name */}
        {step === 0 && (
          <div className="flex-1 flex flex-col justify-center animate-fade-up">
            <div className="text-5xl mb-4">💕</div>
            <h1 className="text-2xl font-bold mb-2">স্বাগতম!</h1>
            <p className="text-white/80 mb-8">তোমার AI partner খুঁজে পেতে সাহায্য করবো। প্রথমে তোমার নাম বলো?</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="তোমার নাম লেখো..."
              className="w-full px-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder:text-white/50 text-lg focus:outline-none focus:ring-2 focus:ring-white/50"
              autoFocus
            />
          </div>
        )}

        {/* Step 1: Interests */}
        {step === 1 && (
          <div className="flex-1 flex flex-col animate-fade-up">
            <h2 className="text-xl font-bold mb-1">তোমার পছন্দ কী? 🎯</h2>
            <p className="text-white/70 text-sm mb-4">যত খুশি select করো — AI তোমার পছন্দ মনে রাখবে!</p>
            <div className="grid grid-cols-2 gap-2">
              {INTEREST_OPTIONS.map(item => (
                <button
                  key={item}
                  onClick={() => toggleItem(interests, item, setInterests)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                    interests.includes(item)
                      ? 'bg-white text-pink-600 shadow-lg scale-[1.02]'
                      : 'bg-white/15 hover:bg-white/25 border border-white/20'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Personality preference */}
        {step === 2 && (
          <div className="flex-1 flex flex-col animate-fade-up">
            <h2 className="text-xl font-bold mb-1">কেমন partner চাও? 💫</h2>
            <p className="text-white/70 text-sm mb-4">তোমার পছন্দের personality বেছে নাও</p>
            <div className="flex flex-col gap-2">
              {PERSONALITY_PREFS.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleItem(personalities, p.id, setPersonalities)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 active:scale-[0.98] ${
                    personalities.includes(p.id)
                      ? 'bg-white text-pink-600 shadow-lg'
                      : 'bg-white/15 hover:bg-white/25 border border-white/20'
                  }`}
                >
                  <span className="text-xl">{p.label.split(' ')[0]}</span>
                  <div>
                    <div className="font-semibold text-sm">{p.label.split(' ').slice(1).join(' ')}</div>
                    <div className={`text-xs ${personalities.includes(p.id) ? 'text-pink-400' : 'text-white/60'}`}>
                      {p.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div className="px-6 pb-6 pt-2">
        <button
          onClick={() => {
            if (step < 2) setStep(s => s + 1);
            else handleFinish();
          }}
          disabled={step === 0 && !name.trim()}
          className="w-full py-3.5 rounded-xl bg-white text-pink-600 font-bold text-lg shadow-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:pointer-events-none"
        >
          {step < 2 ? 'পরবর্তী →' : '🚀 শুরু করো!'}
        </button>
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="w-full mt-2 py-2 text-white/70 text-sm"
          >
            ← আগের ধাপ
          </button>
        )}
      </div>
    </div>
  );
}
