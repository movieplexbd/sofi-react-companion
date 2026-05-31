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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const welcomeSent = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('sofia-dark', String(isDark));
  }, [isDark]);

  useEffect(() => { localStorage.setItem('sofia-lang', lang); }, [lang]);

  // Welcome message — send directly, not via sendMessage('') which exits early for empty strings
  useEffect(() => {
    if (data && !loading && !welcomeSent.current) {
      welcomeSent.current = true;
      sofia.addExtraMessage(sofia.getWelcomeMessage());

      // Phase 11: Auto-build knowledge from QA data on startup (first 50 items)
      if (sofia.intel) {
        sofia.intel.buildFromQABatch(data.qa, 50);
      }
    }
  }, [data, loading]);

  // Phase 12: Smart suggestions while typing
  const handleTyping = useCallback((text: string) => {
    if (!sofia.intel || !data || text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const results = sofia.intel.getSuggestions(text, data.qa, 5);
    setSuggestions(results);
  }, [sofia.intel, data]);

  const handleSend = useCallback(async (text: string) => {
    setSuggestions([]);
    // Phase 12: Record query for trending
    sofia.intel?.recordQuery(text);

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

  // Phase 6+10: Wire feedback to recordClick/recordIgnore for learning
  const handleFeedbackWrapper = useCallback((key: string, isPositive: boolean, userQ?: string) => {
    handleFeedback(key, isPositive, userQ);
    const botMsg = sofia.messages.find(m => m.firebaseKey === key);
    const engines = botMsg?.method ? botMsg.method.split('+') : [];
    if (isPositive) sofia.intel?.recordClick(userQ || '', key, engines);
    else sofia.intel?.recordIgnore(userQ || '', key, engines);
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
    const trending = sofia.intel?.getTrending(3).join(' • ') || '—';
    sofia.addExtraMessage({
      id: `info_${Date.now()}`, sender: 'bot', timestamp: new Date(),
      text: `### 🤖 ${n} v${cfg?.version || '4.0'}\n\n**Intelligence Phases:** 16/16 ✅\n\n**Search Engines:** BM25 · BM25F · TF-IDF · N-gram · Fuzzy · Phonetic · Jaccard · Substring\n\n**Database:** ${data?.qa.length || 0} QA · ${Object.keys(data?.syn || {}).length} Synonyms\n\n**KG Entities:** ${sofia.intel?.graph.size() || 0}\n\n**🔥 Trending:** ${trending}`,
    });
  }, [sofia, data]);

  const handleExport = useCallback(() => {
    const content = sofia.messages.map(m =>
      `[${m.timestamp.toLocaleTimeString()}] ${m.sender === 'user' ? 'You' : 'Sofia'}: ${m.text}`
    ).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sofia-chat-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
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

  // Error UI — Firebase load failed
  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background font-bengali px-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-destructive mb-2">সংযোগ ব্যর্থ হয়েছে</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm">
          Firebase থেকে ডেটা লোড করা যায়নি। ইন্টারনেট সংযোগ চেক করুন।
        </p>
        <p className="text-xs text-muted-foreground mb-6 font-mono bg-secondary px-3 py-2 rounded">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl text-primary-foreground font-semibold transition-all hover:scale-105"
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
            suggestions={suggestions}
            onTyping={handleTyping}
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
