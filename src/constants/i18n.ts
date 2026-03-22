export type Lang = 'bn' | 'en';

export const translations: Record<string, Record<Lang, string>> = {
  typeHere:       { bn: 'প্রশ্ন লিখুন... (বাংলায়)', en: 'Type your question...' },
  loading:        { bn: 'লোড হচ্ছে...',               en: 'Loading...' },
  clearChat:      { bn: 'চ্যাট মুছুন',               en: 'Clear Chat' },
  stats:          { bn: 'পরিসংখ্যান',                 en: 'Statistics' },
  info:           { bn: 'তথ্য',                       en: 'Info' },
  helpful:        { bn: 'সহায়ক ছিলো?',               en: 'Was this helpful?' },
  relatedQ:       { bn: '🔗 সম্পর্কিত প্রশ্ন:',       en: '🔗 Related:' },
  darkMode:       { bn: 'ডার্ক মোড',                  en: 'Dark Mode' },
  search:         { bn: 'বার্তা খুঁজুন...',            en: 'Search messages...' },
  export:         { bn: 'এক্সপোর্ট',                  en: 'Export' },
  retry:          { bn: '🔄 আবার চেষ্টা করো',          en: '🔄 Retry' },
  readMore:       { bn: '📖 আরো পড়ুন...',             en: '📖 Read more...' },
  spellCorrect:   { bn: 'আপনি কি বলতে চেয়েছিলেন:',   en: 'Did you mean:' },
  confirmed:      { bn: '✅ নিশ্চিত',                  en: '✅ Confident' },
  probable:       { bn: '🤔 সম্ভবত',                   en: '🤔 Probable' },
  guess:          { bn: '⚠️ অনুমান',                   en: '⚠️ Guess' },
  clearConfirm:   { bn: 'চ্যাট মুছে ফেলবো?',          en: 'Clear chat history?' },
  chatCleared:    { bn: '👋 চ্যাট পরিষ্কার! নতুন কথা শুরু করো।', en: '👋 Chat cleared! Start fresh.' },
  analytics:      { bn: 'বিশ্লেষণ',                   en: 'Analytics' },
  voice:          { bn: 'ভয়েস ইনপুট',                en: 'Voice Input' },
};

export function t(key: string, lang: Lang): string {
  return translations[key]?.[lang] || key;
}
