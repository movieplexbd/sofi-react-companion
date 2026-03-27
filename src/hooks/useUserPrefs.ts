import { useState, useCallback } from 'react';

export interface UserProfile {
  name: string;
  interests: string[];
  preferredPersonality: string[];
  onboarded: boolean;
}

export interface MatchMemory {
  likes: Record<string, string[]>;   // characterId -> user messages/topics they liked
  dislikes: Record<string, string[]>;
  topicHistory: Record<string, string[]>; // characterId -> topics discussed
  mood: Record<string, string>;       // characterId -> last detected mood
}

const STORAGE_KEY = 'sofia-dating-user';
const MATCH_KEY = 'sofia-dating-matches';
const MEMORY_KEY = 'sofia-dating-memory';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

export function useUserPrefs() {
  const [profile, setProfileState] = useState<UserProfile>(() =>
    loadJSON(STORAGE_KEY, { name: '', interests: [], preferredPersonality: [], onboarded: false })
  );

  const [matches, setMatchesState] = useState<string[]>(() =>
    loadJSON(MATCH_KEY, [])
  );

  const [memory, setMemoryState] = useState<MatchMemory>(() =>
    loadJSON(MEMORY_KEY, { likes: {}, dislikes: {}, topicHistory: {}, mood: {} })
  );

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  const addMatch = useCallback((charId: string) => {
    setMatchesState(prev => {
      if (prev.includes(charId)) return prev;
      const next = [...prev, charId];
      localStorage.setItem(MATCH_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeMatch = useCallback((charId: string) => {
    setMatchesState(prev => {
      const next = prev.filter(id => id !== charId);
      localStorage.setItem(MATCH_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addMemory = useCallback((charId: string, type: 'likes' | 'dislikes' | 'topicHistory', value: string) => {
    setMemoryState(prev => {
      const list = prev[type][charId] || [];
      if (list.includes(value)) return prev;
      const next = { ...prev, [type]: { ...prev[type], [charId]: [...list, value] } };
      localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setMood = useCallback((charId: string, mood: string) => {
    setMemoryState(prev => {
      const next = { ...prev, mood: { ...prev.mood, [charId]: mood } };
      localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getMemoryContext = useCallback((charId: string): string => {
    const m = memory;
    const likes = m.likes[charId] || [];
    const topics = m.topicHistory[charId] || [];
    const mood = m.mood[charId] || '';
    let ctx = '';
    if (profile.name) ctx += `User's name is ${profile.name}. `;
    if (profile.interests.length) ctx += `User likes: ${profile.interests.join(', ')}. `;
    if (likes.length) ctx += `User has shown interest in: ${likes.slice(-5).join(', ')}. `;
    if (topics.length) ctx += `Recent topics: ${topics.slice(-5).join(', ')}. `;
    if (mood) ctx += `User's recent mood: ${mood}. `;
    return ctx;
  }, [memory, profile]);

  return { profile, setProfile, matches, addMatch, removeMatch, memory, addMemory, setMood, getMemoryContext };
}
