import { scrapeRooster } from './rooster';
import { scrapeXpressJobs } from './xpressjobs';
import { scrapeFinder } from './finder';
import { scrapeFindMyJob } from './findmyjob';
import { scrapeTracker } from './tracker';
import { scrapeLinkedIn } from './linkedin';
import { JobListing } from './types';

type ScraperFn = (keywords: string) => Promise<JobListing[]>;

const ALL_SCRAPERS: Array<{ name: string; fn: ScraperFn }> = [
  { name: 'rooster', fn: scrapeRooster },
  { name: 'xpressjobs', fn: scrapeXpressJobs },
  { name: 'finder', fn: scrapeFinder },
  { name: 'findmyjob', fn: scrapeFindMyJob },
  { name: 'tracker', fn: scrapeTracker },
  { name: 'linkedin', fn: scrapeLinkedIn },
];

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 3
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        const val = await tasks[idx]();
        results[idx] = { status: 'fulfilled', value: val };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Runs every scraper for one or more keywords (e.g. derived from the
 * candidate's CV) and returns a deduplicated list of jobs.
 */
export async function scrapeAllJobs(
  keywords: string | string[] = 'intern'
): Promise<JobListing[]> {
  const rawList = (Array.isArray(keywords) ? keywords : [keywords])
    .map((k) => (k || '').trim())
    .filter(Boolean);

  // Deduplicate keywords (case-insensitive)
  const seenKw = new Set<string>();
  const keywordList: string[] = [];
  for (const kw of rawList) {
    const lower = kw.toLowerCase();
    if (!seenKw.has(lower)) {
      seenKw.add(lower);
      keywordList.push(kw);
    }
  }

  const effectiveKeywords = keywordList.length > 0 ? keywordList : ['intern'];

  const tasks = effectiveKeywords.flatMap((keyword) =>
    ALL_SCRAPERS.map((scraper) => () => scraper.fn(keyword))
  );

  const scraperResults = await runWithConcurrency(tasks, 3);

  const allJobs: JobListing[] = [];
  for (const res of scraperResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      allJobs.push(...res.value);
    }
  }

  const JUNIOR_INTERN_RE = /\b(intern|internship|trainee|junior|jr\.?|associate|graduate|entry[- ]level|apprentice)\b/i;

  // Deduplicate by job_url or title+company
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const uniqueJobs: JobListing[] = [];

  for (const job of allJobs) {
    const titleKey = `${job.title.toLowerCase().trim()}_${job.company.toLowerCase().trim()}`;
    const urlKey = job.job_url.toLowerCase().trim();
    if (!seenTitles.has(titleKey) && !seenUrls.has(urlKey)) {
      seenTitles.add(titleKey);
      seenUrls.add(urlKey);
      uniqueJobs.push(job);
    }
  }

  // Prioritize junior & intern positions over generic mid-level titles
  uniqueJobs.sort((a, b) => {
    const aMatch = JUNIOR_INTERN_RE.test(a.title) ? 1 : 0;
    const bMatch = JUNIOR_INTERN_RE.test(b.title) ? 1 : 0;
    return bMatch - aMatch;
  });

  return uniqueJobs;
}
