export type SentimentType = 'positive' | 'negative' | 'urgent' | 'confused' | 'neutral';

export interface SentimentLexicon {
  positive: string[];
  negative: string[];
  urgent: string[];
  confused: string[];
}

export function detectSentiment(text: string, lexicon: SentimentLexicon, enabled: boolean): SentimentType {
  if (!enabled) return 'neutral';
  const words = text.toLowerCase().split(/\s+/);
  const sc: Record<string, number> = { positive: 0, negative: 0, urgent: 0, confused: 0 };
  Object.entries(lexicon).forEach(([type, list]) =>
    (list || []).forEach(w => { if (words.includes(w)) sc[type]++; })
  );
  const top = Object.entries(sc).sort((a, b) => b[1] - a[1]);
  return top[0][1] > 0 ? (top[0][0] as SentimentType) : 'neutral';
}

export const SENT_PREFIXES: Record<SentimentType, string> = {
  negative: '😔 দুঃখিত... ',
  urgent: '⚡ এক্ষুনি বলছি — ',
  confused: '💡 সহজভাবে: ',
  positive: '',
  neutral: '',
};

export const SENT_CHIPS: Record<SentimentType, { text: string }> = {
  negative: { text: '😔 দুঃখিত' },
  positive: { text: '😊' },
  urgent: { text: '⚡ জরুরি' },
  confused: { text: '🤔 বিভ্রান্ত' },
  neutral: { text: '' },
};
