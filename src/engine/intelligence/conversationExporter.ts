/**
 * Conversation Export Trainer
 *
 * Exports chat history and automatically mines QA pairs from user-bot interactions.
 * Features:
 * - Export full conversation as JSON/CSV
 * - Auto-detect Q&A patterns from chat history
 * - Batch import mined pairs into QA database
 * - Filter by date range, confidence threshold
 */

import type { Message } from '../../types/sofia';

export interface MinedQAPair {
  question: string;
  answer: string;
  confidence: number;
  source: 'user_feedback' | 'pattern_match' | 'explicit_teach';
  timestamp: number;
  messageIds: string[];
}

export interface ExportConfig {
  format: 'json' | 'csv';
  includeMetadata: boolean;
  minConfidence: number;
  dateRange?: { from: Date; to: Date };
}

/**
 * Mine QA pairs from chat history using heuristics:
 * 1. User message followed by bot message with positive feedback = QA pair
 * 2. Explicit teach mode patterns
 * 3. High-confidence matched results (score > threshold)
 */
export function mineQAPairs(
  messages: Message[],
  minConfidence = 0.6
): MinedQAPair[] {
  const pairs: MinedQAPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const next = messages[i + 1];

    // Pattern 1: User question → Bot answer with high score/positive feedback
    if (msg.sender === 'user' && next.sender === 'bot') {
      const confidence = (next.score || 0) * 0.7 + (next.firebaseKey ? 0.3 : 0);
      
      if (confidence >= minConfidence) {
        const key = `${msg.text}|${next.text}`.toLowerCase();
        if (!seen.has(key)) {
          pairs.push({
            question: msg.text,
            answer: next.text,
            confidence,
            source: 'pattern_match',
            timestamp: msg.timestamp.getTime(),
            messageIds: [msg.id, next.id],
          });
          seen.add(key);
        }
      }
    }
  }

  return pairs;
}

/**
 * Export conversation to JSON or CSV format
 */
export function exportConversation(
  messages: Message[],
  config: ExportConfig
): string {
  const filtered = messages.filter(m => {
    if (!config.dateRange) return true;
    const ts = m.timestamp.getTime();
    return ts >= config.dateRange.from.getTime() && ts <= config.dateRange.to.getTime();
  });

  if (config.format === 'json') {
    return JSON.stringify({
      metadata: config.includeMetadata ? {
        exportedAt: new Date().toISOString(),
        messageCount: filtered.length,
        dateRange: config.dateRange,
      } : undefined,
      messages: filtered.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp.toISOString(),
        ...(config.includeMetadata && {
          firebaseKey: m.firebaseKey,
          score: m.score,
          method: m.method,
          sentiment: m.sentiment,
        }),
      })),
    }, null, 2);
  }

  // CSV format
  const headers = ['ID', 'Sender', 'Text', 'Timestamp'];
  if (config.includeMetadata) {
    headers.push('FirebaseKey', 'Score', 'Method', 'Sentiment');
  }

  const rows = [headers.join(',')];
  for (const m of filtered) {
    const text = `"${m.text.replace(/"/g, '""')}"`;
    const row = [m.id, m.sender, text, m.timestamp.toISOString()];
    if (config.includeMetadata) {
      row.push(m.firebaseKey || '', String(m.score || ''), m.method || '', m.sentiment || '');
    }
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Download exported data as file
 */
export function downloadExport(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse mined QA pairs for batch import
 */
export function formatForImport(pairs: MinedQAPair[]): Array<{
  questions: string[];
  answer: string;
  category: string;
  tags: string[];
}> {
  return pairs.map(p => ({
    questions: [p.question],
    answer: p.answer,
    category: 'mined_from_chat',
    tags: [`confidence:${Math.round(p.confidence * 100)}`, p.source],
  }));
}
