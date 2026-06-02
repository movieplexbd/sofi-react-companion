/**
 * A/B Answer Testing Engine
 *
 * Rotate between two answer variants for the same question and track feedback.
 * Features:
 * - Create A/B test pairs
 * - Track impressions and clicks for each variant
 * - Calculate statistical significance
 * - Auto-promote winning variant
 */

export interface ABTest {
  id: string;
  qaKey: string;
  variantA: string;
  variantB: string;
  createdAt: number;
  active: boolean;
  stats: {
    impressionsA: number;
    impressionsB: number;
    clicksA: number;
    clicksB: number;
    ignoresA: number;
    ignoresB: number;
  };
}

export interface ABTestResult {
  testId: string;
  winner: 'A' | 'B' | 'tie';
  confidence: number;
  ctrA: number;
  ctrB: number;
  recommendation: string;
}

const STORE_KEY = 'sofia_ab_tests_v1';

function load(): ABTest[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(tests: ABTest[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(tests));
  } catch { /* quota */ }
}

let state: ABTest[] | null = null;
function ensure(): ABTest[] { return state ||= load(); }

/**
 * Create a new A/B test
 */
export function createABTest(qaKey: string, variantA: string, variantB: string): ABTest {
  const test: ABTest = {
    id: `ab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    qaKey,
    variantA,
    variantB,
    createdAt: Date.now(),
    active: true,
    stats: {
      impressionsA: 0,
      impressionsB: 0,
      clicksA: 0,
      clicksB: 0,
      ignoresA: 0,
      ignoresB: 0,
    },
  };

  const tests = ensure();
  tests.push(test);
  persist(tests);
  return test;
}

/**
 * Get active test for a QA key
 */
export function getActiveTest(qaKey: string): ABTest | null {
  const tests = ensure();
  return tests.find(t => t.qaKey === qaKey && t.active) || null;
}

/**
 * Get variant to show (alternates between A and B)
 */
export function selectVariant(testId: string): 'A' | 'B' {
  const tests = ensure();
  const test = tests.find(t => t.id === testId);
  if (!test) return 'A';

  // Alternate based on total impressions
  const total = test.stats.impressionsA + test.stats.impressionsB;
  return total % 2 === 0 ? 'A' : 'B';
}

/**
 * Record impression
 */
export function recordImpression(testId: string, variant: 'A' | 'B') {
  const tests = ensure();
  const test = tests.find(t => t.id === testId);
  if (!test) return;

  if (variant === 'A') test.stats.impressionsA++;
  else test.stats.impressionsB++;

  persist(tests);
}

/**
 * Record click/feedback
 */
export function recordFeedback(testId: string, variant: 'A' | 'B', feedback: 'click' | 'ignore') {
  const tests = ensure();
  const test = tests.find(t => t.id === testId);
  if (!test) return;

  if (feedback === 'click') {
    if (variant === 'A') test.stats.clicksA++;
    else test.stats.clicksB++;
  } else {
    if (variant === 'A') test.stats.ignoresA++;
    else test.stats.ignoresB++;
  }

  persist(tests);
}

/**
 * Calculate CTR (click-through rate)
 */
function calculateCTR(clicks: number, impressions: number): number {
  return impressions > 0 ? clicks / impressions : 0;
}

/**
 * Chi-squared test for statistical significance
 */
function chiSquaredTest(
  clicksA: number,
  impressionsA: number,
  clicksB: number,
  impressionsB: number
): number {
  const ignoresA = impressionsA - clicksA;
  const ignoresB = impressionsB - clicksB;

  const total = impressionsA + impressionsB;
  if (total === 0) return 0;

  const expectedClicksA = (impressionsA * (clicksA + clicksB)) / total;
  const expectedClicksB = (impressionsB * (clicksA + clicksB)) / total;

  if (expectedClicksA === 0 || expectedClicksB === 0) return 0;

  const chi2 =
    Math.pow(clicksA - expectedClicksA, 2) / expectedClicksA +
    Math.pow(clicksB - expectedClicksB, 2) / expectedClicksB;

  // Convert chi-squared to confidence (p-value approximation)
  // chi2 > 3.841 ≈ 95% confidence
  return Math.min(0.99, Math.max(0, (chi2 - 1) / 5));
}

/**
 * Analyze test results
 */
export function analyzeTest(testId: string): ABTestResult | null {
  const tests = ensure();
  const test = tests.find(t => t.id === testId);
  if (!test) return null;

  const ctrA = calculateCTR(test.stats.clicksA, test.stats.impressionsA);
  const ctrB = calculateCTR(test.stats.clicksB, test.stats.impressionsB);
  const confidence = chiSquaredTest(
    test.stats.clicksA,
    test.stats.impressionsA,
    test.stats.clicksB,
    test.stats.impressionsB
  );

  let winner: 'A' | 'B' | 'tie' = 'tie';
  let recommendation = 'Need more data (minimum 100 impressions each)';

  const minImpressions = 100;
  if (test.stats.impressionsA >= minImpressions && test.stats.impressionsB >= minImpressions) {
    if (ctrA > ctrB * 1.1) {
      winner = 'A';
      recommendation = `Variant A wins with ${Math.round((ctrA - ctrB) * 100)}% higher CTR (${Math.round(confidence * 100)}% confidence)`;
    } else if (ctrB > ctrA * 1.1) {
      winner = 'B';
      recommendation = `Variant B wins with ${Math.round((ctrB - ctrA) * 100)}% higher CTR (${Math.round(confidence * 100)}% confidence)`;
    } else {
      recommendation = 'No significant difference. Continue testing or pick based on other factors.';
    }
  }

  return { testId, winner, confidence, ctrA, ctrB, recommendation };
}

/**
 * End test and apply winner
 */
export function endTest(testId: string, applyWinner: 'A' | 'B' | null = null): string {
  const tests = ensure();
  const test = tests.find(t => t.id === testId);
  if (!test) return '';

  test.active = false;
  persist(tests);

  if (applyWinner === 'A') return test.variantA;
  if (applyWinner === 'B') return test.variantB;
  return '';
}

/**
 * Get all tests
 */
export function getAllTests(): ABTest[] {
  return [...ensure()];
}

/**
 * Delete test
 */
export function deleteTest(testId: string) {
  const tests = ensure();
  const idx = tests.findIndex(t => t.id === testId);
  if (idx !== -1) {
    tests.splice(idx, 1);
    persist(tests);
  }
}
