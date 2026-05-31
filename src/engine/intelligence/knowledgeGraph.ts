/**
 * Phase 4 — Lightweight Knowledge Graph
 *
 * In-memory directed graph: Entity → { relations[], categories[] }
 * Used to add a "graph match" score: if a query mentions an entity that
 * shares categories with the candidate's tags/category, give a boost.
 *
 * The graph is extensible: addEntity / addRelation can be called at runtime
 * to grow it from user data or remote sources.
 */

export interface KGNode {
  name: string;
  categories: string[];
  relations: string[]; // names of related nodes
}

export class KnowledgeGraph {
  private nodes = new Map<string, KGNode>();

  addEntity(name: string, categories: string[] = [], relations: string[] = []) {
    const key = name.toLowerCase();
    const existing = this.nodes.get(key);
    if (existing) {
      existing.categories = [...new Set([...existing.categories, ...categories])];
      existing.relations  = [...new Set([...existing.relations, ...relations])];
    } else {
      this.nodes.set(key, { name, categories: [...categories], relations: [...relations] });
    }
  }

  addRelation(a: string, b: string) {
    this.addEntity(a, [], [b]);
    this.addEntity(b, [], [a]);
  }

  get(name: string): KGNode | undefined { return this.nodes.get(name.toLowerCase()); }
  size() { return this.nodes.size; }
  serialize() { return [...this.nodes.values()]; }

  /** Find entities present in the token stream */
  matchEntities(tokens: string[]): KGNode[] {
    const hits: KGNode[] = [];
    for (const t of tokens) {
      const n = this.nodes.get(t.toLowerCase());
      if (n) hits.push(n);
    }
    return hits;
  }

  /**
   * Compute a 0..1 graph score for how well a candidate's category/tags
   * align with the entities detected in the query.
   */
  graphScore(tokens: string[], candidateCategory: string, candidateTags: string[] = []): number {
    const ents = this.matchEntities(tokens);
    if (!ents.length) return 0;
    const target = new Set([candidateCategory?.toLowerCase(), ...candidateTags.map(t => t.toLowerCase())]);
    let hit = 0;
    for (const e of ents) {
      for (const c of e.categories) if (target.has(c.toLowerCase())) { hit++; break; }
    }
    return Math.min(1, hit / ents.length);
  }
}

/* ── Seed graph with a small example set — extendable ── */
export function buildDefaultGraph(): KnowledgeGraph {
  const g = new KnowledgeGraph();
  // Animals
  g.addEntity('lion',   ['animal', 'mammal', 'wildlife']);
  g.addEntity('tiger',  ['animal', 'mammal', 'wildlife']);
  g.addEntity('সিংহ',   ['animal', 'mammal', 'wildlife']);
  g.addEntity('বাঘ',    ['animal', 'mammal', 'wildlife']);
  // Clothing
  g.addEntity('shirt',  ['clothing', 'fashion', 'apparel']);
  g.addEntity('pant',   ['clothing', 'fashion', 'apparel']);
  g.addEntity('শার্ট',  ['clothing', 'fashion', 'apparel']);
  g.addEntity('শাড়ি',   ['clothing', 'fashion', 'apparel']);
  // Tech
  g.addEntity('phone',  ['tech', 'electronics', 'mobile']);
  g.addEntity('laptop', ['tech', 'electronics', 'computer']);
  g.addEntity('ফোন',    ['tech', 'electronics', 'mobile']);
  // Food
  g.addEntity('rice',   ['food', 'grain']);
  g.addEntity('ভাত',    ['food', 'grain']);
  g.addEntity('মাছ',    ['food', 'protein']);
  // Education
  g.addEntity('school', ['education', 'institution']);
  g.addEntity('স্কুল',   ['education', 'institution']);
  g.addEntity('book',   ['education', 'reading']);
  g.addEntity('বই',     ['education', 'reading']);
  return g;
}
