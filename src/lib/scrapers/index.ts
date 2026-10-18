import { scrapeRooster } from './rooster';
import { scrapeXpressJobs } from './xpressjobs';
import { scrapeFinder } from './finder';
import { scrapeFindMyJob } from './findmyjob';
import { scrapeTracker } from './tracker';
import { JobListing } from './types';

export async function scrapeAllJobs(keywords: string = 'intern'): Promise<JobListing[]> {
  const scraperResults = await Promise.allSettled([
    scrapeRooster(keywords),
    scrapeXpressJobs(keywords),
    scrapeFinder(keywords),
    scrapeFindMyJob(keywords),
    scrapeTracker(keywords),
  ]);

  const allJobs: JobListing[] = [];
  for (const res of scraperResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      allJobs.push(...res.value);
    }
  }

  // Deduplicate by job_url or title+company
  const seen = new Set<string>();
  const uniqueJobs: JobListing[] = [];

  for (const job of allJobs) {
    const key = `${job.title.toLowerCase().trim()}_${job.company.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueJobs.push(job);
    }
  }

  return uniqueJobs;
}
