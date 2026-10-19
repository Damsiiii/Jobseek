const RELATIVE_RE = /(\d+)\s*(minute|hour|day|week|month)s?\s*(?:ago)?/i;

/**
 * Parses free-form date text (or a datetime attribute) into ISO `YYYY-MM-DD`.
 * Handles: ISO strings, "3 days ago", "Posted 2 weeks ago", "30+ days ago",
 * "2025-11-04", "Nov 4, 2025", "4 Nov 2025".
 * Returns null when no plausible date can be extracted.
 */
export function toIsoDate(raw?: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  // Plain ISO date (or ISO datetime) embedded in the string
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Relative time: "3 days ago", "2 weeks", "24 hours"
  const relMatch = text.match(RELATIVE_RE);
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10);
    if (!isNaN(amount) && amount >= 0) {
      const unit = relMatch[2].toLowerCase();
      const now = new Date();
      const msPerUnit: Record<string, number> = {
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      };
      const ms = amount * (msPerUnit[unit] || 0);
      if (ms > 0) {
        return new Date(now.getTime() - ms).toISOString().slice(0, 10);
      }
    }
  }

  // Absolute date parseable by the JS Date constructor
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000 && parsed.getFullYear() <= 2100) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Given a cheerio element, finds the most likely "posted date" node and
 * extracts an ISO date from its `datetime` attribute or text content.
 */
export function extractPostedDate(
  $: import('cheerio').CheerioAPI,
  el: import('domhandler').Element
): string | null {
  const candidates = $(el).find(
    'time, [class*="date"], [class*="posted"], [class*="time"], .job-date, .posted-on'
  );
  let found: string | null = null;
  candidates.each((_, node) => {
    if (found) return false; // stop early once found
    const fromAttr = $(node).attr('datetime') || $(node).attr('title');
    found = toIsoDate(fromAttr) || toIsoDate($(node).text());
    return !found;
  });
  if (found) return found;

  // Last resort: scan the card's own text for a relative-date phrase
  return toIsoDate($(el).text());
}
