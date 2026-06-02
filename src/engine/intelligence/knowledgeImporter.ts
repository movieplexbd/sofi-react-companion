/**
 * Knowledge Import from URL
 *
 * Scrapes content from URLs (Wikipedia, blogs, docs) and auto-generates QA pairs.
 * Features:
 * - Fetch and parse HTML content
 * - Extract paragraphs and headings
 * - Generate Q&A from extracted text using heuristics
 * - Batch import into knowledge base
 */

export interface ImportedQAPair {
  question: string;
  answer: string;
  source: string;
  sourceUrl: string;
  category: string;
  confidence: number;
}

interface ExtractedContent {
  title: string;
  url: string;
  paragraphs: string[];
  headings: string[];
}

/**
 * Fetch and extract content from URL
 */
export async function extractContentFromUrl(url: string): Promise<ExtractedContent> {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'text/html' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract title
    const title = doc.querySelector('title')?.textContent || 'Unknown';

    // Extract paragraphs
    const paragraphs: string[] = [];
    doc.querySelectorAll('p, article, main').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 50) paragraphs.push(text);
    });

    // Extract headings
    const headings: string[] = [];
    doc.querySelectorAll('h1, h2, h3').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 5) headings.push(text);
    });

    return { title, url, paragraphs, headings };
  } catch (error) {
    console.error('Failed to extract from URL:', error);
    throw error;
  }
}

/**
 * Generate Q&A pairs from extracted content
 * Uses heuristics:
 * - Heading → Question, next paragraph → Answer
 * - Sentence fragments → Questions
 * - Key terms → Question patterns
 */
export function generateQAFromContent(content: ExtractedContent): ImportedQAPair[] {
  const pairs: ImportedQAPair[] = [];
  const seen = new Set<string>();

  // Strategy 1: Heading + following paragraph
  for (let i = 0; i < content.headings.length; i++) {
    const heading = content.headings[i];
    const para = content.paragraphs[i] || '';

    if (heading && para) {
      // Convert heading to question if not already
      let question = heading;
      if (!question.endsWith('?')) {
        question = `What is ${heading}?`;
      }

      const key = `${question}|${para.substring(0, 100)}`.toLowerCase();
      if (!seen.has(key)) {
        pairs.push({
          question,
          answer: para.substring(0, 500),
          source: content.title,
          sourceUrl: content.url,
          category: 'imported_knowledge',
          confidence: 0.7,
        });
        seen.add(key);
      }
    }
  }

  // Strategy 2: Extract key sentences as Q&A
  for (const para of content.paragraphs) {
    const sentences = para.split(/[।.!?]+/).filter(s => s.trim().length > 10);

    for (let i = 0; i < sentences.length - 1; i++) {
      const sent = sentences[i].trim();
      const nextSent = sentences[i + 1].trim();

      // If sentence contains key terms, make it a question
      if (sent.length > 20 && sent.length < 150 && nextSent.length > 20) {
        const question = sent.endsWith('?') ? sent : `${sent}?`;
        const key = `${question}|${nextSent}`.toLowerCase();

        if (!seen.has(key) && !question.includes('http')) {
          pairs.push({
            question,
            answer: nextSent,
            source: content.title,
            sourceUrl: content.url,
            category: 'imported_knowledge',
            confidence: 0.5,
          });
          seen.add(key);
        }
      }
    }
  }

  return pairs.slice(0, 50); // Limit to prevent bloat
}

/**
 * Import from multiple URLs
 */
export async function importFromUrls(
  urls: string[],
  onProgress?: (current: number, total: number, status: string) => void
): Promise<ImportedQAPair[]> {
  const allPairs: ImportedQAPair[] = [];

  for (let i = 0; i < urls.length; i++) {
    try {
      onProgress?.(i + 1, urls.length, `Fetching ${urls[i]}...`);
      const content = await extractContentFromUrl(urls[i]);
      const pairs = generateQAFromContent(content);
      allPairs.push(...pairs);
    } catch (error) {
      console.error(`Failed to import from ${urls[i]}:`, error);
      onProgress?.(i + 1, urls.length, `Failed: ${urls[i]}`);
    }
  }

  return allPairs;
}

/**
 * Format imported pairs for database insertion
 */
export function formatImportedForDB(pairs: ImportedQAPair[]): Array<{
  questions: string[];
  answer: string;
  category: string;
  tags: string[];
}> {
  return pairs.map(p => ({
    questions: [p.question],
    answer: p.answer,
    category: p.category,
    tags: [
      `source:${p.source}`,
      `confidence:${Math.round(p.confidence * 100)}`,
      'imported',
    ],
  }));
}
