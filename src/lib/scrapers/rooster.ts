import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobListing } from './types';
import { extractPostedDate } from './dateUtils';

export async function scrapeRooster(keywords: string = 'intern'): Promise<JobListing[]> {
  const results: JobListing[] = [];
  try {
    const url = `https://rooster.lk/jobs?query=${encodeURIComponent(keywords)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    $('.job-card, .job-item, article').each((_, el) => {
      const title = $(el).find('h2, h3, .job-title, .title').text().trim();
      const company = $(el).find('.company-name, .company, .employer').text().trim() || 'Top Sri Lankan Tech Co';
      const location = $(el).find('.location, .address').text().trim() || 'Colombo, Sri Lanka';
      const link = $(el).find('a').attr('href');
      const description = $(el).find('.description, .summary, p').text().trim() || `${title} internship opportunity at ${company}.`;
      const posted_date = extractPostedDate($, el);

      if (title && link) {
        const fullUrl = link.startsWith('http') ? link : `https://rooster.lk${link}`;
        results.push({
          title,
          company,
          location,
          source: 'Rooster.lk',
          job_url: fullUrl,
          description: description || `Software / Tech Internship position for ${title} at ${company}.`,
          posted_date,
        });
      }
    });
  } catch (error) {
    console.warn('Rooster scraper fallback or live fetch notice:', error);
  }

  return results;
}
