import { useState, useCallback, useRef, useMemo } from 'react';
import { createSofiaEngine, chunkAnswer, type ReplyResult } from '../engine/queryEngine';
import type { DataStore, RuntimeState, Message } from '../types/sofia';
import type { Database } from 'firebase/database';

function createInitialRuntime(): RuntimeState {
  return {
    state: 'normal', learningQ: null, userName: null,
    history: [], activeCtx: { name: null, lifespan: 0 },
    memory: { topics: [], entities: {}, preferences: {} },
    personality: 'friendly', initialized: false,
    lastAnswer: null, lastUserQ: null,
    sessionId: Date.now().toString(36),
    stats: { totalMessages: 0, matchedCount: 0, noMatchCount: 0, avgScore: 0 },
  };
}

let msgCounter = 0;
function makeId() { return `msg_${Date.now()}_${++msgCounter}`; }

export function useSofia(data: DataStore | null, db: Database | null) {
  const rtRef = useRef<RuntimeState>(createInitialRuntime());
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [personality, setPersonalityState] = useState('friendly');

  const engine = useMemo(() => {
    if (!data) return null;
    const rt = rtRef.current;
    rt.initialized = true;
    return createSofiaEngine(data, rt, db);
  }, [data, db]);

  const setPersonality = useCallback((p: string) => {
    rtRef.current.personality = p;
    setPersonalityState(p);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !engine) return;
    const rt = rtRef.current;

    // Add user message
    const userMsg: Message = {
      id: makeId(), sender: 'user', text, timestamp: new Date(),
      threadId: rt.lastUserQ ? `thread_${Date.now()}` : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate typing delay
    await new Promise(r => setTimeout(r, 350 + Math.random() * 350));

    const reply = await engine.getReply(text);
    const { main, extra } = data?.cfg.features?.answerChunking !== false
      ? chunkAnswer(reply.answer)
      : { main: reply.answer, extra: null };

    const botMsg: Message = {
      id: makeId(), sender: 'bot', text: main, timestamp: new Date(),
      firebaseKey: reply.firebaseKey, method: reply.method,
      score: reply.score, sentiment: reply.sentiment,
      related: reply.related, spellCorrected: reply.spellCorrected,
      originalText: reply.originalText, isMath: reply.isMath,
      quickReplies: reply.quickReplies,
      threadId: userMsg.threadId,
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);

    // Handle extra chunk
    if (extra) {
      const extraMsg: Message = {
        id: makeId(), sender: 'bot', text: extra, timestamp: new Date(),
        threadId: userMsg.threadId,
      };
      // We'll return extra so the UI can show "Read more" button
      return { extraMessage: extraMsg };
    }
    return null;
  }, [engine, data]);

  const addExtraMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const clearChat = useCallback(() => {
    const rt = rtRef.current;
    rt.history = [];
    rt.activeCtx = { name: null, lifespan: 0 };
    rt.memory = { topics: [], entities: {}, preferences: {} };
    setMessages([{
      id: makeId(), sender: 'bot', text: '👋 চ্যাট পরিষ্কার! নতুন কথা শুরু করো।',
      timestamp: new Date(),
    }]);
  }, []);

  const addReaction = useCallback((msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, reactions: [...(m.reactions || []), emoji] } : m
    ));
  }, []);

  const retryMessage = useCallback(async (originalText: string) => {
    if (!engine) return;
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 350));
    const reply = await engine.getReply(originalText);
    const botMsg: Message = {
      id: makeId(), sender: 'bot', text: reply.answer, timestamp: new Date(),
      firebaseKey: reply.firebaseKey, method: reply.method,
      score: reply.score, sentiment: reply.sentiment,
      related: reply.related,
    };
    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  }, [engine]);

  const getWelcomeMessage = useCallback((): Message => {
    const cfg = data?.cfg;
    const n = cfg?.botName || 'Sofia';
    const v = cfg?.version || '4.0';
    const qaLen = data?.qa.length || 0;
    const intLen = data ? Object.keys(data.int).length : 0;
    const entLen = data ? Object.keys(data.ent).length : 0;
    return {
      id: makeId(), sender: 'bot', timestamp: new Date(),
      text: `👋 **হ্যালো! আমি ${n} v${v}** — Ultra Intelligent Bangla AI 🔥\n\n**🧠 Active Engines (7টি):**\nBM25 • BM25F • TF-IDF • N-gram • Fuzzy • Phonetic • Jaccard\n\n**✨ Smart Features:**\nQuery Expansion • Ensemble Voting • Spell Correct • Math • DateTime • Context Memory • Adaptive Learning • Related Questions\n\n📊 **${qaLen} QA** লোড | **${intLen} Intents** | **${entLen} Entities**\n\nকিভাবে সাহায্য করতে পারি? 😊`,
      quickReplies: ['তুমি কে?', '৫×৬ কত?', 'আজ কি বার?', 'সাহায্য করো'],
    };
  }, [data]);

  return {
    messages, isTyping, personality,
    sendMessage, clearChat, setPersonality,
    addReaction, retryMessage, addExtraMessage,
    getWelcomeMessage, runtime: rtRef.current, data,
  };
}
