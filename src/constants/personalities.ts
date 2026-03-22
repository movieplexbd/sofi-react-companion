export interface Personality {
  prefix: string;
  emojiBoost: boolean;
  formalPrefix: string;
  typingMsg: string;
  label: string;
  emoji: string;
}

export const PERSONALITIES: Record<string, Personality> = {
  friendly:  { prefix: '',          emojiBoost: true,  formalPrefix: '',           typingMsg: 'Sofia লিখছে... 💬',           label: 'বন্ধুসুলভ',  emoji: '😊' },
  formal:    { prefix: 'অবশ্যই, ',  emojiBoost: false, formalPrefix: 'মহোদয়, ',    typingMsg: 'Sofia উত্তর তৈরি করছে...',     label: 'আনুষ্ঠানিক',  emoji: '🎩' },
  teacher:   { prefix: '💡 শোনো, ', emojiBoost: true,  formalPrefix: '',           typingMsg: 'Sofia বুঝিয়ে বলছে... 📚',     label: 'শিক্ষক',      emoji: '📚' },
  assistant: { prefix: '',          emojiBoost: true,  formalPrefix: '',           typingMsg: 'Sofia প্রস্তুত হচ্ছে...',       label: 'সহকারী',      emoji: '💼' },
  concise:   { prefix: '',          emojiBoost: false, formalPrefix: '',           typingMsg: '⚡',                           label: 'সংক্ষিপ্ত',    emoji: '⚡' },
};
