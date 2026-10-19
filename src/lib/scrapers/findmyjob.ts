import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobListing } from './types';
import { extractPostedDate } from './dateUtils';

export async function scrapeFindMyJob(keywords: string = 'intern'): Promise<JobListing[]> {
  const results: JobListing[] = [];
  try {
    const url = `https://findmyjob.lk/jobs?search=${encodeURIComponent(keywords)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    $('.job-card, .job-listing, .job-item').each((_, el) => {
      const title = $(el).find('h3, .title, .job-title').text().trim();
      const company = $(el).find('.company').text().trim() || 'FindMyJob Partner';
      const location = $(el).find('.location').text().trim() || 'Sri Lanka';
      const link = $(el).find('a').attr('href');
      const description = $(el).find('.description').text().trim();
      const posted_date = extractPostedDate($, el);

      if (title && link) {
        const fullUrl = link.startsWith('http') ? link : `https://findmyjob.lk${link}`;
        results.push({
          title,
          company,
          location,
          source: 'FindMyJob.lk',
          job_url: fullUrl,
          description: description || `Internship vacancy: ${title} at ${company}.`,
          posted_date,
        });
      }
    });
  } catch (error) {
    console.warn('FindMyJob scraper notice:', error);
  }

  return results;
}
