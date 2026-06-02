/**
 * Confidence-based Fallback Chain
 *
 * When answer confidence is low, suggests:
 * 1. Related QA pairs
 * 2. Web search
 * 3. Teach mode
 * 4. Similar questions user asked before
 *
 * Features:
 * - Confidence thresholds
 * - Fallback strategies
 * - Learning from fallbacks
 */

import type { QAItem } from '../../types/sofia';

export interface FallbackStrategy {
  type: 'related_qa' | 'web_search' | 'teach_mode' | 'history' | 'ask_clarification';
  priority: number;
  trigger: (confidence: number) => boolean;
  message: string;
  action?: string;
}

export interface ConfidenceResult {
  confidence: number;
  level: 'high' | 'medium' | 'low' | 'critical';
  fallbacks: FallbackStrategy[];
  recommendation: string;
}

/**
 * Evaluate confidence level
 */
export function evaluateConfidence(score: number | null | undefined): ConfidenceResult {
  const confidence = score || 0;

  let level: 'high' | 'medium' | 'low' | 'critical';
  if (confidence >= 0.8) level = 'high';
  else if (confidence >= 0.6) level = 'medium';
  else if (confidence >= 0.3) level = 'low';
  else level = 'critical';

  const fallbacks: FallbackStrategy[] = [];

  // Low confidence → suggest related QA
  if (confidence < 0.7) {
    fallbacks.push({
      type: 'related_qa',
      priority: 1,
      trigger: (c) => c < 0.7,
      message: 'এই প্রশ্নের সাথে সম্পর্কিত উত্তর দেখুন',
      action: 'show_related',
    });
  }

  // Very low confidence → suggest web search
  if (confidence < 0.5) {
    fallbacks.push({
      type: 'web_search',
      priority: 2,
      trigger: (c) => c < 0.5,
      message: 'আরও তথ্যের জন্য ওয়েব সার্চ করুন',
      action: 'search_web',
    });
  }

  // Critical confidence → teach mode
  if (confidence < 0.3) {
    fallbacks.push({
      type: 'teach_mode',
      priority: 3,
      trigger: (c) => c < 0.3,
      message: 'আপনার উত্তর শেয়ার করুন এবং আমাকে শেখান',
      action: 'teach_mode',
    });
  }

  // Low confidence → ask for clarification
  if (confidence < 0.6) {
    fallbacks.push({
      type: 'ask_clarification',
      priority: 4,
      trigger: (c) => c < 0.6,
      message: 'আপনার প্রশ্ন আরও বিস্তারিত করুন',
      action: 'ask_clarification',
    });
  }

  let recommendation = '';
  if (level === 'high') {
    recommendation = 'উত্তর নির্ভরযোগ্য';
  } else if (level === 'medium') {
    recommendation = 'উত্তর সম্ভবত সঠিক, কিন্তু যাচাই করুন';
  } else if (level === 'low') {
    recommendation = 'সম্পর্কিত উত্তর দেখুন বা প্রশ্ন পুনরায় জিজ্ঞাসা করুন';
  } else {
    recommendation = 'উত্তর খুঁজে পাওয়া যায়নি। অন্য উপায় চেষ্টা করুন';
  }

  return { confidence, level, fallbacks, recommendation };
}

/**
 * Find related QA items
 */
export function findRelatedQA(
  currentItem: QAItem | null,
  allItems: QAItem[],
  topN = 3
): QAItem[] {
  if (!currentItem) return [];

  const related: Array<{ item: QAItem; score: number }> = [];

  for (const item of allItems) {
    if (item.firebaseKey === currentItem.firebaseKey) continue;

    // Same category boost
    let score = 0;
    if (item.category === currentItem.category) score += 0.5;

    // Tag overlap
    const currentTags = new Set(currentItem.tags || []);
    const itemTags = new Set(item.tags || []);
    const overlap = [...currentTags].filter(t => itemTags.has(t)).length;
    score += overlap * 0.15;

    // Token overlap in questions
    const currentTokens = new Set(
      (currentItem.originalQuestions || []).join(' ').toLowerCase().split(/\s+/)
    );
    const itemTokens = new Set(
      (item.originalQuestions || []).join(' ').toLowerCase().split(/\s+/)
    );
    const tokenOverlap = [...currentTokens].filter(t => itemTokens.has(t)).length;
    score += Math.min(0.3, tokenOverlap * 0.05);

    if (score > 0) {
      related.push({ item, score });
    }
  }

  return related
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(r => r.item);
}

/**
 * Generate web search query from question
 */
export function generateSearchQuery(question: string): string {
  // Remove common stop words
  const stopWords = new Set([
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'is', 'are', 'am', 'be', 'been', 'being',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'কি', 'কেন', 'কিভাবে', 'কখন', 'কোথায়', 'কে', 'যা', 'এবং', 'বা',
  ]);

  const tokens = question
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopWords.has(t));

  return tokens.slice(0, 5).join(' ');
}

/**
 * Track fallback usage for learning
 */
const FALLBACK_STORE_KEY = 'sofia_fallback_stats_v1';

export interface FallbackStats {
  type: string;
  usedCount: number;
  successCount: number;
  lastUsed: number;
}

export function recordFallbackUsage(type: string, success: boolean) {
  try {
    const stats: FallbackStats[] = JSON.parse(
      localStorage.getItem(FALLBACK_STORE_KEY) || '[]'
    );

    const existing = stats.find(s => s.type === type);
    if (existing) {
      existing.usedCount++;
      if (success) existing.successCount++;
      existing.lastUsed = Date.now();
    } else {
      stats.push({
        type,
        usedCount: 1,
        successCount: success ? 1 : 0,
        lastUsed: Date.now(),
      });
    }

    localStorage.setItem(FALLBACK_STORE_KEY, JSON.stringify(stats));
  } catch { /* quota */ }
}

export function getFallbackStats(): FallbackStats[] {
  try {
    return JSON.parse(localStorage.getItem(FALLBACK_STORE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Get success rate for fallback strategy
 */
export function getFallbackSuccessRate(type: string): number {
  const stats = getFallbackStats();
  const entry = stats.find(s => s.type === type);
  if (!entry || entry.usedCount === 0) return 0;
  return entry.successCount / entry.usedCount;
}

/**
 * Rank fallback strategies by effectiveness
 */
export function rankFallbacks(fallbacks: FallbackStrategy[]): FallbackStrategy[] {
  return fallbacks.sort((a, b) => {
    const aRate = getFallbackSuccessRate(a.type);
    const bRate = getFallbackSuccessRate(b.type);
    if (aRate !== bRate) return bRate - aRate; // Higher success rate first
    return a.priority - b.priority; // Then by priority
  });
}
