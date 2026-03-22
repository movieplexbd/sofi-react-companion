const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

/** Try to answer Bengali time/date questions */
export function tryTimeDate(text: string, enabled: boolean): string | null {
  if (!enabled) return null;
  const now = new Date();
  const h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? 'সকাল' : h < 17 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';

  if (/কটা বাজ|সময় কত|এখন কয়টা|time কত|what time/i.test(text))
    return `এখন **${ampm} ${h > 12 ? h - 12 : h || 12}:${m}** ⏰`;
  if (/আজকের তারিখ|আজ কত তারিখ|today.*date|date.*today/i.test(text))
    return `আজ **${BN_DAYS[now.getDay()]}**, ${now.getDate()} ${BN_MONTHS[now.getMonth()]} ${now.getFullYear()} 📅`;
  if (/আজ কি বার|কি বার|what day/i.test(text))
    return `আজ **${BN_DAYS[now.getDay()]}** 📅`;
  if (/কোন মাস|এখন কোন মাস|current month/i.test(text))
    return `এখন **${BN_MONTHS[now.getMonth()]}** মাস 📅`;
  if (/কত সাল|কোন বছর|what year/i.test(text))
    return `এখন **${now.getFullYear()} সাল** 📅`;
  return null;
}
