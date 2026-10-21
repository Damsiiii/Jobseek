import { JobListing } from './types';
import { toIsoDate } from './dateUtils';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Scrapes live remote tech jobs from RemoteOK public JSON API.
 */
export async function scrapeRemoteOk(keyword = ''): Promise<JobListing[]> {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const jobs: JobListing[] = [];
    const kw = keyword.toLowerCase().trim();

    for (const item of data) {
      if (!item.position || !item.url) continue;
      const title = String(item.position || '').trim();
      const company = String(item.company || 'Unknown').trim();
      const desc = stripHtml(String(item.description || ''));
      const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';

      if (kw) {
        const matches =
          title.toLowerCase().includes(kw) ||
          tags.toLowerCase().includes(kw) ||
          desc.toLowerCase().includes(kw);
        if (!matches) continue;
      }

      jobs.push({
        title,
        company,
        location: item.location ? String(item.location).trim() : 'Remote (Worldwide)',
        source: 'RemoteOK',
        job_url: String(item.url).startsWith('http')
          ? String(item.url)
          : `https://remoteok.com${item.url}`,
        description: desc.slice(0, 3000),
        posted_date: toIsoDate(item.date),
      });

      if (jobs.length >= 30) break;
    }

    return jobs;
  } catch (err) {
    console.error('RemoteOK scraper error:', err);
    return [];
  }
}

/**
 * Scrapes live remote jobs from Remotive public API.
 */
export async function scrapeRemotive(keyword = ''): Promise<JobListing[]> {
  try {
    const kw = keyword.trim();
    const url = kw
      ? `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw)}&limit=30`
      : 'https://remotive.com/api/remote-jobs?limit=30';

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.jobs)) return [];

    return data.jobs.slice(0, 30).map((item: any) => ({
      title: String(item.title || '').trim(),
      company: String(item.company_name || 'Unknown').trim(),
      location: String(item.candidate_required_location || 'Remote').trim(),
      source: 'Remotive',
      job_url: String(item.url),
      description: stripHtml(String(item.description || '')).slice(0, 3000),
      posted_date: toIsoDate(item.publication_date),
    }));
  } catch (err) {
    console.error('Remotive scraper error:', err);
    return [];
  }
}

/**
 * Aggregates and deduplicates remote jobs from all configured remote sources.
 */
export async function scrapeRemoteJobs(keyword = ''): Promise<JobListing[]> {
  const [rokRes, remRes] = await Promise.allSettled([
    scrapeRemoteOk(keyword),
    scrapeRemotive(keyword),
  ]);

  const allJobs: JobListing[] = [];
  if (rokRes.status === 'fulfilled') allJobs.push(...rokRes.value);
  if (remRes.status === 'fulfilled') allJobs.push(...remRes.value);

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

  return uniqueJobs;
}
