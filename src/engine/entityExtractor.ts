import type { QAItem } from '../types/sofia';

export function extractEntities(
  text: string,
  entityMap: Record<string, string[]>,
  enabled: boolean
): Record<string, string[]> {
  if (!enabled) return {};
  const found: Record<string, string[]> = {};
  Object.entries(entityMap).forEach(([type, words]) => {
    (words || []).forEach(w => {
      if (text.includes(w)) {
        if (!found[type]) found[type] = [];
        found[type].push(w);
      }
    });
  });
  return found;
}

export function entityBoost(item: QAItem, entities: Record<string, string[]>): number {
  let boost = 1;
  Object.values(entities).flat().forEach(e => {
    if ((item.answer || '').includes(e)) boost += 0.2;
  });
  return boost;
}
