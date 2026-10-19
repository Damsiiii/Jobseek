import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobListing } from './types';
import { extractPostedDate } from './dateUtils';

/**
 * Scrapes LinkedIn's public job search (guest-accessible) for internships
 * in Sri Lanka matching the given keywords.
 *
 * Notes:
 * - `f_E=1` filters for Internship experience level, `f_TPR=r604800`
 *   limits results to postings from the last 7 days.
 * - LinkedIn frequently blocks datacenter IPs (HTTP 999) or serves a
 *   login wall. In that case we return an empty list rather than
 *   fabricating listings — results from this source are best-effort.
 */
export async function scrapeLinkedIn(keywords: string = 'intern'): Promise<JobListing[]> {
  const results: JobListing[] = [];
  try {
    const url =
      `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(keywords)}` +
      `&location=${encodeURIComponent('Sri Lanka')}` +
      `&f_E=1&f_TPR=r604800&position=1&pageNum=0`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: (status) => status === 200,
    });

    const $ = cheerio.load(response.data);

    $('.job-search-card, .base-search-card').each((_, el) => {
      const title = $(el)
        .find('.base-search-card__title, h3.base-search-card__title, .job-search-card__title')
        .text()
        .trim();
      const company = $(el)
        .find('.base-search-card__subtitle a, .job-search-card__company-name, h4.base-search-card__subtitle a')
        .text()
        .trim();
      const location =
        $(el).find('.job-search-card__location, .base-search-card__location').text().trim() ||
        'Sri Lanka';
      const link = $(el)
        .find('a.base-card__full-link, a.base-search-card__link, h3.base-search-card__title a, a.job-search-card__link')
        .attr('href');
      const posted_date = extractPostedDate($, el);

      if (title && link) {
        const fullUrl = link.split('?')[0];
        results.push({
          title,
          company: company || 'LinkedIn Company',
          location,
          source: 'LinkedIn',
          job_url: fullUrl,
          description: `${title} internship opening at ${company || 'a company'} in ${location}, listed on LinkedIn. Requirements and full job description are available on the LinkedIn posting.`,
          posted_date,
        });
      }
    });
  } catch (error) {
    // LinkedIn returns HTTP 999 when blocking automated requests
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    console.warn(
      'LinkedIn scraper notice:',
      status ? `HTTP ${status} (blocked or unavailable)` : error
    );
  }

  return results;
}
