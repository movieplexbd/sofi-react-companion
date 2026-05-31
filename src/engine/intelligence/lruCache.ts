/**
 * Phase 9 — LRU Cache
 * Mobile-friendly bounded cache with O(1) get/set using Map insertion order.
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private hits = 0;
  private misses = 0;
  private storageKey: string | null = null;

  constructor(private capacity = 100, name?: string) {
    if (name) {
      this.storageKey = `sofia_cache_stats_${name}`;
      this.loadStats();
    }
  }

  private loadStats() {
    if (!this.storageKey) return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.hits = parsed.hits || 0;
        this.misses = parsed.misses || 0;
      }
    } catch { /* ignore */ }
  }

  private saveStats() {
    if (!this.storageKey) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ hits: this.hits, misses: this.misses }));
    } catch { /* ignore */ }
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      this.misses++;
      this.saveStats();
      return undefined;
    }
    const v = this.map.get(key)!;
    this.map.delete(key); this.map.set(key, v); // bump to MRU
    this.hits++;
    this.saveStats();
    return v;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  has(key: K) { return this.map.has(key); }
  clear() {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
    this.saveStats();
  }
  get size() { return this.map.size; }
  stats() {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, size: this.map.size,
      capacity: this.capacity, hitRate: total ? this.hits / total : 0 };
  }
}
