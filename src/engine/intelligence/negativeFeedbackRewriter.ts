/**
 * Negative Feedback Rewriter
 *
 * Identifies answers that are repeatedly ignored and suggests rewrites.
 * Features:
 * - Track ignored answers
 * - Flag problematic answers
 * - Generate rewrite suggestions
 * - Batch apply rewrites
 */

import { recordEvent, snapshot as fbSnapshot } from './feedbackLearning';

export interface IgnoredAnswer {
  qaKey: string;
  question: string;
  answer: string;
  ignoreCount: number;
  clickCount: number;
  ignoreRate: number;
  lastIgnoredAt: number;
  severity: 'low' | 'medium' | 'high';
}

export interface RewriteSuggestion {
  qaKey: string;
  originalAnswer: string;
  suggestedRewrite: string;
  reason: string;
  confidence: number;
}

/**
 * Find answers with high ignore rates
 */
export function findIgnoredAnswers(
  qaIndex: Record<string, { questions?: string[]; question?: string; answer?: string }>,
  ignoreThreshold = 0.5
): IgnoredAnswer[] {
  const fb = fbSnapshot();
  const ignored: Record<string, { ignores: number; clicks: number; lastIgnored: number }> = {};

  // Count ignores and clicks per result
  for (const event of fb.events) {
    const bucket = ignored[event.resultKey] ||= { ignores: 0, clicks: 0, lastIgnored: 0 };
    if (event.kind === 'ignored') {
      bucket.ignores++;
      bucket.lastIgnored = event.ts;
    } else if (event.kind === 'clicked') {
      bucket.clicks++;
    }
  }

  const results: IgnoredAnswer[] = [];

  for (const [key, stats] of Object.entries(ignored)) {
    const total = stats.ignores + stats.clicks;
    if (total < 3) continue; // Need minimum engagement

    const ignoreRate = stats.ignores / total;
    if (ignoreRate < ignoreThreshold) continue;

    const qa = qaIndex[key];
    if (!qa) continue;

    const question = qa.questions?.[0] || qa.question || '';
    const answer = qa.answer || '';

    let severity: 'low' | 'medium' | 'high' = 'low';
    if (ignoreRate > 0.8) severity = 'high';
    else if (ignoreRate > 0.65) severity = 'medium';

    results.push({
      qaKey: key,
      question,
      answer,
      ignoreCount: stats.ignores,
      clickCount: stats.clicks,
      ignoreRate,
      lastIgnoredAt: stats.lastIgnored,
      severity,
    });
  }

  return results.sort((a, b) => b.ignoreRate - a.ignoreRate);
}

/**
 * Generate rewrite suggestions based on answer characteristics
 */
export function generateRewriteSuggestions(ignored: IgnoredAnswer[]): RewriteSuggestion[] {
  const suggestions: RewriteSuggestion[] = [];

  for (const item of ignored) {
    const answer = item.answer;
    const issues: string[] = [];
    let rewrite = answer;

    // Issue 1: Answer too long
    if (answer.length > 500) {
      issues.push('Answer is too long');
      const sentences = answer.split(/[।.!?]+/).filter(s => s.trim());
      rewrite = sentences.slice(0, 3).join('. ') + '.';
    }

    // Issue 2: Too technical/complex
    const complexWords = answer.match(/[a-z]{10,}/gi) || [];
    if (complexWords.length > answer.split(/\s+/).length * 0.3) {
      issues.push('Language too complex');
      rewrite = simplifyText(rewrite);
    }

    // Issue 3: Missing context
    if (answer.length < 30) {
      issues.push('Answer too brief');
      rewrite = answer + ' [Add more context or examples]';
    }

    // Issue 4: Unclear structure
    if (!answer.includes('\n') && answer.length > 200) {
      issues.push('Poor formatting');
      rewrite = formatAnswer(rewrite);
    }

    // Issue 5: Negative tone
    const negativeWords = ['no', 'cannot', 'impossible', 'wrong', 'fail', 'error'];
    const hasNegative = negativeWords.some(w => answer.toLowerCase().includes(w));
    if (hasNegative && !answer.toLowerCase().includes('however')) {
      issues.push('Negative tone');
      rewrite = rewriteWithPositiveTone(rewrite);
    }

    if (issues.length > 0) {
      suggestions.push({
        qaKey: item.qaKey,
        originalAnswer: answer,
        suggestedRewrite: rewrite,
        reason: issues.join(', '),
        confidence: Math.min(0.95, 0.5 + issues.length * 0.15),
      });
    }
  }

  return suggestions;
}

/**
 * Simplify complex text
 */
function simplifyText(text: string): string {
  const replacements: Record<string, string> = {
    'utilize': 'use',
    'facilitate': 'help',
    'implement': 'do',
    'demonstrate': 'show',
    'subsequently': 'then',
    'furthermore': 'also',
    'nevertheless': 'but',
    'regarding': 'about',
    'approximately': 'about',
  };

  let simplified = text;
  for (const [complex, simple] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${complex}\\b`, 'gi');
    simplified = simplified.replace(regex, simple);
  }

  return simplified;
}

/**
 * Format answer with better structure
 */
function formatAnswer(text: string): string {
  // Break into sentences and add line breaks
  const sentences = text.split(/[।.!?]+/).filter(s => s.trim());
  if (sentences.length <= 1) return text;

  const formatted = sentences.slice(0, 4).map(s => s.trim()).join('\n• ');
  return '• ' + formatted;
}

/**
 * Rewrite with positive tone
 */
function rewriteWithPositiveTone(text: string): string {
  const negativeReplacements: Record<string, string> = {
    'cannot do': 'can try to',
    'is not possible': 'may require',
    'will not work': 'may need adjustment',
    'impossible': 'challenging',
    'failed': 'encountered issues with',
    'wrong': 'different approach',
  };

  let rewritten = text;
  for (const [negative, positive] of Object.entries(negativeReplacements)) {
    const regex = new RegExp(`\\b${negative}\\b`, 'gi');
    rewritten = rewritten.replace(regex, positive);
  }

  return rewritten;
}

/**
 * Flag answers for manual review
 */
export interface FlaggedAnswer {
  qaKey: string;
  question: string;
  answer: string;
  reason: string;
  flaggedAt: number;
}

const FLAG_STORE_KEY = 'sofia_flagged_answers_v1';

export function flagAnswer(qaKey: string, question: string, answer: string, reason: string) {
  try {
    const flagged: FlaggedAnswer[] = JSON.parse(localStorage.getItem(FLAG_STORE_KEY) || '[]');
    const existing = flagged.findIndex(f => f.qaKey === qaKey);

    if (existing >= 0) {
      flagged[existing] = { qaKey, question, answer, reason, flaggedAt: Date.now() };
    } else {
      flagged.push({ qaKey, question, answer, reason, flaggedAt: Date.now() });
    }

    localStorage.setItem(FLAG_STORE_KEY, JSON.stringify(flagged.slice(-100)));
  } catch { /* quota */ }
}

export function getFlaggedAnswers(): FlaggedAnswer[] {
  try {
    return JSON.parse(localStorage.getItem(FLAG_STORE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearFlag(qaKey: string) {
  try {
    const flagged: FlaggedAnswer[] = JSON.parse(localStorage.getItem(FLAG_STORE_KEY) || '[]');
    const filtered = flagged.filter(f => f.qaKey !== qaKey);
    localStorage.setItem(FLAG_STORE_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}
