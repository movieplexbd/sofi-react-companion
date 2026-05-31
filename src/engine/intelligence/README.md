# Sofia Intelligence Layer

Modular, dependency-free upgrade that turns Sofia into a hybrid retrieval
assistant — no AI APIs, no embeddings, no pretrained models.

## File map

| Phase | File | Purpose |
|------:|------|---------|
| 1 | `queryUnderstanding.ts` | Detect intent (definition, comparison, recommendation, tutorial, greeting, follow-up, question) |
| 2 | `normalizer.ts` | Lowercase, tokenize, stopwords, stemming, lemmatization, Banglish collapse, dedupe |
| 3 | `synonymEngine.ts` | Local bn+en+banglish synonym DB + query expansion |
| 4 | `knowledgeGraph.ts` | In-memory entity graph + graph-match scoring |
| 5 | `adaptiveScoring.ts` | Per-engine weights that evolve from user interactions |
| 6 | `feedbackLearning.ts` | Track shown / clicked / ignored events → boost |
| 7 | `contextMemory.ts` | Short-term + long-term + topic resolution for follow-ups |
| 8 | `rankingPipeline.ts` | Multi-stage merge → context → synonym → graph → feedback |
| 9 | `lruCache.ts` | Bounded LRU cache for query + result reuse |
| 10 | (dashboard) | See `src/components/sofia/AnalyticsDashboard.tsx` |

The facade is `index.ts` (`createIntelligence()`). `queryEngine.ts` consumes it.

## Backward compatibility

- All 8 existing search engines (BM25 … Substring) are untouched.
- Existing `useSofia` hook, message shape, Firebase logging — unchanged.
- New layer wraps the search results, adds boosts, learns from interactions.
