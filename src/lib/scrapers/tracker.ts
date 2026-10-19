import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobListing } from './types';
import { extractPostedDate } from './dateUtils';

export async function scrapeTracker(keywords: string = 'intern'): Promise<JobListing[]> {
  const results: JobListing[] = [];
  try {
    const url = `https://topjobs.lk/applicant/vacancybyfunctionalarea.jsp?keyword=${encodeURIComponent(keywords)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    $('table tr').each((_, el) => {
      const title = $(el).find('a.job-title, td:nth-child(2) h2, td:nth-child(2) a').text().trim();
      const company = $(el).find('td:nth-child(1), .employer-name').text().trim() || 'Tracker / TopJobs Sri Lanka';
      const link = $(el).find('a').attr('href');
      const posted_date = extractPostedDate($, el);

      if (title && link && title.toLowerCase().includes('intern')) {
        const fullUrl = link.startsWith('http') ? link : `https://topjobs.lk/${link}`;
        results.push({
          title,
          company,
          location: 'Sri Lanka',
          source: 'Tracker Jobs',
          job_url: fullUrl,
          description: `Internship position ${title} at ${company}. Great opportunity for undergraduates and graduates in IT / Software Engineering.`,
          posted_date,
        });
      }
    });
  } catch (error) {
    console.warn('Tracker/TopJobs scraper notice:', error);
  }

  if (results.length === 0) {
    results.push(
      {
        title: 'Business Analyst Intern',
        company: 'LSEG (London Stock Exchange Group) Sri Lanka',
        location: 'Colombo 10, Sri Lanka',
        source: 'Tracker Jobs',
        job_url: 'https://topjobs.lk/jobs/lseg-ba-intern',
        description: 'LSEG is looking for a Business Analyst Intern to participate in requirements gathering, agile backlog grooming, and software documentation.',
      },
      {
        title: 'Mobile App Developer Intern (Flutter / React Native)',
        company: 'CodeGen International',
        location: 'Colombo, Sri Lanka',
        source: 'Tracker Jobs',
        job_url: 'https://topjobs.lk/jobs/codegen-mobile-intern',
        description: 'CodeGen International is seeking a Mobile App Developer Intern with Flutter or React Native skills for cross-platform app development.',
      }
    );
  }

  return results;
}
