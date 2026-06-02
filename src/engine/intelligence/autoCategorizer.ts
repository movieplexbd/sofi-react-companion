/**
 * Auto Category Clustering
 *
 * Groups uncategorized QA pairs by semantic similarity.
 * Features:
 * - Similarity-based clustering
 * - Suggest categories for uncategorized items
 * - Batch assign categories
 */

import { tokenize } from '../textProcessing';

export interface CategorySuggestion {
  qaKey: string;
  question: string;
  answer: string;
  suggestedCategory: string;
  confidence: number;
  similarTo: string[];
}

/**
 * Calculate Jaccard similarity between two token sets
 */
function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate cosine similarity between token vectors
 */
function cosineSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  if (intersection.size === 0) return 0;
  return intersection.size / Math.sqrt(set1.size * set2.size);
}

/**
 * Find similar QA items
 */
export function findSimilarItems(
  question: string,
  allItems: Array<{
    key: string;
    question: string;
    category?: string;
  }>,
  topN = 5,
  threshold = 0.3
): Array<{ key: string; question: string; similarity: number }> {
  const queryTokens = tokenize(question);
  const similarities: Array<{ key: string; question: string; similarity: number }> = [];

  for (const item of allItems) {
    const itemTokens = tokenize(item.question);
    const sim = Math.max(
      jaccardSimilarity(queryTokens, itemTokens),
      cosineSimilarity(queryTokens, itemTokens)
    );

    if (sim >= threshold) {
      similarities.push({ key: item.key, question: item.question, similarity: sim });
    }
  }

  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topN);
}

/**
 * Suggest categories for uncategorized items
 */
export function suggestCategories(
  uncategorizedItems: Array<{
    key: string;
    question: string;
    answer: string;
  }>,
  categorizedItems: Array<{
    key: string;
    question: string;
    category: string;
  }>
): CategorySuggestion[] {
  const suggestions: CategorySuggestion[] = [];

  for (const item of uncategorizedItems) {
    const similar = findSimilarItems(item.question, categorizedItems, 5, 0.25);

    if (similar.length > 0) {
      // Find most common category among similar items
      const categoryVotes: Record<string, number> = {};
      for (const sim of similar) {
        const cat = categorizedItems.find(c => c.key === sim.key)?.category;
        if (cat) {
          categoryVotes[cat] = (categoryVotes[cat] || 0) + sim.similarity;
        }
      }

      const bestCategory = Object.entries(categoryVotes).sort(([, a], [, b]) => b - a)[0];
      if (bestCategory) {
        const [category, score] = bestCategory;
        suggestions.push({
          qaKey: item.key,
          question: item.question,
          answer: item.answer,
          suggestedCategory: category,
          confidence: Math.min(0.99, score / 3),
          similarTo: similar.map(s => s.question),
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Cluster items by similarity
 */
export interface Cluster {
  id: string;
  suggestedName: string;
  items: Array<{
    key: string;
    question: string;
    similarity: number;
  }>;
  avgSimilarity: number;
}

export function clusterByContent(
  items: Array<{
    key: string;
    question: string;
  }>,
  threshold = 0.4
): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (const item of items) {
    if (assigned.has(item.key)) continue;

    const cluster: Cluster = {
      id: `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      suggestedName: '',
      items: [{ key: item.key, question: item.question, similarity: 1 }],
      avgSimilarity: 1,
    };

    assigned.add(item.key);

    // Find similar items
    for (const other of items) {
      if (assigned.has(other.key)) continue;

      const sim = Math.max(
        jaccardSimilarity(tokenize(item.question), tokenize(other.question)),
        cosineSimilarity(tokenize(item.question), tokenize(other.question))
      );

      if (sim >= threshold) {
        cluster.items.push({ key: other.key, question: other.question, similarity: sim });
        assigned.add(other.key);
      }
    }

    // Calculate average similarity
    cluster.avgSimilarity =
      cluster.items.reduce((sum, i) => sum + i.similarity, 0) / cluster.items.length;

    // Suggest cluster name from most common tokens
    const allTokens = cluster.items.flatMap(i => tokenize(i.question));
    const tokenFreq: Record<string, number> = {};
    for (const token of allTokens) {
      tokenFreq[token] = (tokenFreq[token] || 0) + 1;
    }

    const topTokens = Object.entries(tokenFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([token]) => token);

    cluster.suggestedName = topTokens.join(' ') || 'Cluster';

    clusters.push(cluster);
  }

  return clusters.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
}

/**
 * Merge similar items into one
 */
export interface MergeProposal {
  sourceKey: string;
  targetKey: string;
  sourceQuestion: string;
  targetQuestion: string;
  similarity: number;
  recommendation: string;
}

export function findMergeCandidates(
  items: Array<{
    key: string;
    question: string;
  }>,
  threshold = 0.85
): MergeProposal[] {
  const proposals: MergeProposal[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = Math.max(
        jaccardSimilarity(tokenize(items[i].question), tokenize(items[j].question)),
        cosineSimilarity(tokenize(items[i].question), tokenize(items[j].question))
      );

      if (sim >= threshold) {
        const key = [items[i].key, items[j].key].sort().join('|');
        if (!seen.has(key)) {
          proposals.push({
            sourceKey: items[j].key,
            targetKey: items[i].key,
            sourceQuestion: items[j].question,
            targetQuestion: items[i].question,
            similarity: sim,
            recommendation: `Merge "${items[j].question}" into "${items[i].question}" (${Math.round(sim * 100)}% similar)`,
          });
          seen.add(key);
        }
      }
    }
  }

  return proposals.sort((a, b) => b.similarity - a.similarity);
}
