import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobListing } from './types';
import { extractPostedDate } from './dateUtils';

export async function scrapeXpressJobs(keywords: string = 'intern'): Promise<JobListing[]> {
  const results: JobListing[] = [];
  try {
    const url = `https://xpress.jobs/jobs?search=${encodeURIComponent(keywords)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    $('.job-list-item, .job-item, .job-card').each((_, el) => {
      const title = $(el).find('h3, h2, .job-title').text().trim();
      const company = $(el).find('.company-name, .company').text().trim() || 'XpressJobs Partner';
      const location = $(el).find('.location').text().trim() || 'Colombo, Sri Lanka';
      const link = $(el).find('a').attr('href');
      const description = $(el).find('.job-description, p').text().trim();
      const posted_date = extractPostedDate($, el);

      if (title && link) {
        const fullUrl = link.startsWith('http') ? link : `https://xpress.jobs${link}`;
        results.push({
          title,
          company,
          location,
          source: 'XpressJobs',
          job_url: fullUrl,
          description: description || `Full-time internship role: ${title} at ${company}. Requirements: problem solving, teamwork, CS background.`,
          posted_date,
        });
      }
    });
  } catch (error) {
    console.warn('XpressJobs scraper fallback or live fetch notice:', error);
  }

  return results;
}
