import { useState, useCallback, useEffect, useRef } from 'react';
import BootScreen from '../components/sofia/BootScreen';
import ChatHeader from '../components/sofia/ChatHeader';
import PersonalityBar from '../components/sofia/PersonalityBar';
import ChatBox from '../components/sofia/ChatBox';
import TypingIndicator from '../components/sofia/TypingIndicator';
import InputArea from '../components/sofia/InputArea';
import SearchBar from '../components/sofia/SearchBar';
import AnalyticsDashboard from '../components/sofia/AnalyticsDashboard';
import { useFirebase } from '../hooks/useFirebase';
import { useSofia } from '../hooks/useSofia';
import { t, type Lang } from '../constants/i18n';
import type { Message } from '../types/sofia';
import { Toaster, toast } from 'sonner';

export default function SofiaChat() {
  const { data, loading, error, bootSteps, bootProgress, db, handleFeedback } = useFirebase();
  const sofia = useSofia(data, db);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('sofia-dark') === 'true');
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('sofia-lang') as Lang) || 'bn');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const [matchBadge, setMatchBadge] = useState<string | null>(null);
  const [extraMessages, setExtraMessages] = useState<Map<string, Message>>(new Map());
  const welcomeSent = useRef(false);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('sofia-dark', String(isDark));
  }, [isDark]);

  // Language
  useEffect(() => { localStorage.setItem('sofia-lang', lang); }, [lang]);

  // Send welcome message when data is loaded
  useEffect(() => {
    if (data && !loading && !welcomeSent.current) {
      welcomeSent.current = true;
      const welcome = sofia.getWelcomeMessage();
      // Directly add the welcome message
      sofia.sendMessage(''); // This won't do anything since empty, but we need to trigger initial state
    }
  }, [data, loading]);

  // Add welcome message
  useEffect(() => {
    if (data && !loading && sofia.messages.length === 0 && welcomeSent.current) {
      const welcome = sofia.getWelcomeMessage();
      // We need to manually set this - let's use addExtraMessage
      sofia.addExtraMessage(welcome);
    }
  }, [data, loading, sofia.messages.length]);

  const handleSend = useCallback(async (text: string) => {
    const result = await sofia.sendMessage(text);
    if (result?.extraMessage) {
      // Find the last bot message and associate extra with it
      setTimeout(() => {
        const lastBotMsg = [...sofia.messages].reverse().find(m => m.sender === 'bot');
        if (lastBotMsg) {
          setExtraMessages(prev => new Map(prev).set(lastBotMsg.id, result.extraMessage));
        }
      }, 100);
    }

    // Show match badge briefly
    const lastMsg = sofia.messages[sofia.messages.length - 1];
    if (lastMsg?.score && lastMsg?.method) {
      setMatchBadge(`${lastMsg.score}% match`);
      setTimeout(() => setMatchBadge(null), 4000);
    }
  }, [sofia]);

  const handleFeedbackWrapper = useCallback((key: string, isPositive: boolean, userQ?: string) => {
    handleFeedback(key, isPositive, userQ);
    toast(isPositive ? '👍 ধন্যবাদ! আমি আরো ভালো হবো।' : '👎 Feedback দেওয়ার জন্য ধন্যবাদ!');
  }, [handleFeedback]);

  const handleClearChat = useCallback(() => {
    if (confirm(t('clearConfirm', lang))) {
      sofia.clearChat();
      toast('🗑️ Chat cleared');
    }
  }, [sofia, lang]);

  const handleShowStats = useCallback(() => {
    const rt = sofia.runtime;
    const rate = rt.stats.totalMessages > 0 ? Math.round(rt.stats.matchedCount / rt.stats.totalMessages * 100) : 0;
    sofia.addExtraMessage({
      id: `stats_${Date.now()}`, sender: 'bot', timestamp: new Date(),
      text: `### 📊 Session Statistics\n\n| বিষয় | সংখ্যা |\n|---|---|\n| মোট Message | ${rt.stats.totalMessages} |\n| Match পেয়েছে | ${rt.stats.matchedCount} |\n| Match পায়নি | ${rt.stats.noMatchCount} |\n| Match Rate | ${rate}% |\n| Avg Score | ${Math.round(rt.stats.avgScore)}% |\n\n**Personality:** ${rt.personality} | **Topics:** ${rt.memory.topics.slice(-3).join(', ') || '—'}`,
    });
  }, [sofia]);

  const handleShowInfo = useCallback(() => {
    const cfg = data?.cfg;
    const n = cfg?.botName || 'Sofia';
    sofia.addExtraMessage({
      id: `info_${Date.now()}`, sender: 'bot', timestamp: new Date(),
      text: `### 🤖 ${n} v${cfg?.version || '4.0'} — Engine Info\n\n**Search Engines (7টি):**\n- BM25 + BM25F (field-weighted)\n- TF-IDF\n- N-gram\n- Fuzzy (Levenshtein)\n- Phonetic (বাংলা)\n- Jaccard Similarity\n\n**Database:**\n- ${data?.qa.length || 0} QA\n- ${Object.keys(data?.syn || {}).length} Synonym Groups\n- ${Object.keys(data?.int || {}).length} Intents\n- ${Object.keys(data?.ent || {}).length} Entity Groups\n- ${Object.keys(data?.tpl || {}).length} Template Types`,
    });
  }, [sofia, data]);

  const handleExport = useCallback(() => {
    const content = sofia.messages.map(m =>
      `[${m.timestamp.toLocaleTimeString()}] ${m.sender === 'user' ? 'You' : 'Sofia'}: ${m.text}`
    ).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sofia-chat-${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
    toast('📥 Chat exported!');
  }, [sofia.messages]);

  const handleReadMore = useCallback((msgId: string) => {
    const extra = extraMessages.get(msgId);
    if (extra) {
      sofia.addExtraMessage(extra);
      setExtraMessages(prev => { const m = new Map(prev); m.delete(msgId); return m; });
    }
  }, [extraMessages, sofia]);

  const handlePersonalityChange = useCallback((p: string) => {
    sofia.setPersonality(p);
    toast(`🎭 Personality: ${p}`);
  }, [sofia]);

  const lowConf = data?.cfg.thresholds?.lowConfidence || 35;
  const highConf = data?.cfg.thresholds?.highConfidence || 70;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-background font-bengali">
      <Toaster position="bottom-center" />

      <BootScreen steps={bootSteps} progress={bootProgress} visible={loading} />

      {!loading && (
        <>
          <ChatHeader
            botName={data?.cfg.botName || 'Sofia'}
            version={data?.cfg.version || '4.0'}
            qaCount={data?.qa.length || 0}
            intentCount={Object.keys(data?.int || {}).length}
            onClearChat={handleClearChat}
            onShowStats={handleShowStats}
            onShowInfo={handleShowInfo}
            onToggleSearch={() => setSearchVisible(v => !v)}
            onToggleDark={() => setIsDark(v => !v)}
            onExport={handleExport}
            onToggleAnalytics={() => setAnalyticsVisible(v => !v)}
            isDark={isDark}
            lang={lang}
            onToggleLang={() => setLang(l => l === 'bn' ? 'en' : 'bn')}
            matchBadge={matchBadge}
          />

          <PersonalityBar active={sofia.personality} onSelect={handlePersonalityChange} />

          <SearchBar
            visible={searchVisible}
            onSearch={setSearchQuery}
            onClose={() => setSearchVisible(false)}
            placeholder={t('search', lang)}
          />

          <ChatBox
            messages={sofia.messages}
            onSendMessage={handleSend}
            onFeedback={handleFeedbackWrapper}
            onReaction={sofia.addReaction}
            onRetry={sofia.retryMessage}
            lowConfThreshold={lowConf}
            highConfThreshold={highConf}
            lang={lang}
            searchQuery={searchQuery}
            extraMessages={extraMessages}
            onReadMore={handleReadMore}
          />

          <TypingIndicator visible={sofia.isTyping} personality={sofia.personality} />

          <InputArea
            onSend={handleSend}
            disabled={!data || sofia.isTyping}
            placeholder={t('typeHere', lang)}
          />

          <AnalyticsDashboard
            visible={analyticsVisible}
            onClose={() => setAnalyticsVisible(false)}
            runtime={sofia.runtime}
          />
        </>
      )}
    </div>
  );
}
