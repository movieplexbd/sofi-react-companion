/** Try to evaluate Bengali/English math expressions */
export function tryMath(text: string, enabled: boolean): string | null {
  if (!enabled) return null;
  const bn2en: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  let t = text.replace(/[০-৯]/g, c => bn2en[c] || c);
  t = t.replace(/যোগ|plus/gi, '+').replace(/বিয়োগ|minus/gi, '-')
    .replace(/গুণ|times|×/gi, '*').replace(/ভাগ|divided|÷/gi, '/')
    .replace(/শতাংশ|percent|%/gi, '/100').replace(/এর/g, '')
    .replace(/[^0-9\s\+\-\*\/\(\)\.]/g, ' ').trim();
  const match = t.match(/[\d\s\+\-\*\/\(\)\.]{3,}/);
  if (!match) return null;
  try {
    const expr = match[0].trim();
    const result = Function('"use strict";return (' + expr + ')')();
    if (isFinite(result) && !isNaN(result))
      return `📐 ${expr.trim()} = **${Number(result.toFixed(6))}**`;
  } catch { /* skip */ }
  return null;
}
