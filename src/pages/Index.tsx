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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('sofia-dark', String(isDark));
  }, [isDark]);

  useEffect(() => { localStorage.setItem('sofia-lang', lang); }, [lang]);

  // FIX: Send welcome message directly via addExtraMessage (sendMessage('') returns early for empty strings)
  useEffect(() => {
    if (data && !loading && !welcomeSent.current) {
      welcomeSent.current = true;
      const welcome = sofia.getWelcomeMessage();
      sofia.addExtraMessage(welcome);
    }
  }, [data, loading]);

  const handleSend = useCallback(async (text: string) => {
    const result = await sofia.sendMessage(text);
    if (result?.extraMessage) {
      setTimeout(() => {
        const lastBotMsg = [...sofia.messages].reverse().find(m => m.sender === 'bot');
        if (lastBotMsg) {
          setExtraMessages(prev => new Map(prev).set(lastBotMsg.id, result.extraMessage));
        }
      }, 100);
    }
    const lastMsg = sofia.messages[sofia.messages.length - 1];
    if (lastMsg?.score && lastMsg?.method) {
      setMatchBadge(`${lastMsg.score}%`);
      setTimeout(() => setMatchBadge(null), 3000);
    }
  }, [sofia]);

  // FIX: Wire up Phase 6 feedback learning — recordClick for positive, recordIgnore for negative
  const handleFeedbackWrapper = useCallback((key: string, isPositive: boolean, userQ?: string) => {
    handleFeedback(key, isPositive, userQ);

    // Find the matching bot message to get its engines list
    const botMsg = sofia.messages.find(m => m.firebaseKey === key);
    const engines = botMsg?.method ? botMsg.method.split('+') : [];

    if (isPositive) {
      sofia.intel?.recordClick(userQ || '', key, engines);
    } else {
      sofia.intel?.recordIgnore(userQ || '', key, engines);
    }

    toast(isPositive ? '👍 ধন্যবাদ!' : '👎 Feedback দেওয়ার জন্য ধন্যবাদ!');
  }, [handleFeedback, sofia]);

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
      text: `### 📊 Session Stats\n\n| Item | Count |\n|---|---|\n| Messages | ${rt.stats.totalMessages} |\n| Matched | ${rt.stats.matchedCount} |\n| No Match | ${rt.stats.noMatchCount} |\n| Rate | ${rate}% |\n| Avg Score | ${Math.round(rt.stats.avgScore)}% |`,
    });
  }, [sofia]);

  const handleShowInfo = useCallback(() => {
    const cfg = data?.cfg;
    const n = cfg?.botName || 'Sofia';
    sofia.addExtraMessage({
      id: `info_${Date.now()}`, sender: 'bot', timestamp: new Date(),
      text: `### 🤖 ${n} v${cfg?.version || '4.0'}\n\n**7 Search Engines:**\nBM25 · BM25F · TF-IDF · N-gram · Fuzzy · Phonetic · Jaccard\n\n**Database:** ${data?.qa.length || 0} QA · ${Object.keys(data?.syn || {}).length} Synonyms · ${Object.keys(data?.int || {}).length} Intents · ${Object.keys(data?.ent || {}).length} Entities`,
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
    toast(`🎭 ${p}`);
  }, [sofia]);

  const lowConf = data?.cfg.thresholds?.lowConfidence || 35;
  const highConf = data?.cfg.thresholds?.highConfidence || 70;

  // FIX: Show error UI when Firebase load fails
  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background font-bengali px-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-destructive mb-2">সংযোগ ব্যর্থ হয়েছে</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm">
          Firebase থেকে ডেটা লোড করা যায়নি। ইন্টারনেট সংযোগ চেক করুন এবং পেজ রিলোড করুন।
        </p>
        <p className="text-xs text-muted-foreground mb-6 font-mono bg-secondary px-3 py-2 rounded">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl text-primary-foreground font-semibold transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--header-gradient, hsl(280 70% 36%))' }}
        >
          🔄 আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

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
            intel={sofia.intel}
          />
        </>
      )}
    </div>
  );
}
