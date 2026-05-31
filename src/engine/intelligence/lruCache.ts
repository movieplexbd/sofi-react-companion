/**
 * Phase 9 — LRU Cache
 * Mobile-friendly bounded cache with O(1) get/set using Map insertion order.
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private hits = 0;
  private misses = 0;
  constructor(private capacity = 100) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) { this.misses++; return undefined; }
    const v = this.map.get(key)!;
    this.map.delete(key); this.map.set(key, v); // bump to MRU
    this.hits++;
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
  clear() { this.map.clear(); this.hits = 0; this.misses = 0; }
  get size() { return this.map.size; }
  stats() {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, size: this.map.size,
      capacity: this.capacity, hitRate: total ? this.hits / total : 0 };
  }
}
