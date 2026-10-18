import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scrapeAllJobs } from '@/lib/scrapers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const triggerScrape = searchParams.get('scrape') === 'true';
    const keyword = searchParams.get('keyword') || 'intern';

    const db = await getDb();

    if (triggerScrape) {
      const scraped = await scrapeAllJobs(keyword);
      for (const job of scraped) {
        await db.run(
          `INSERT INTO jobs (title, company, location, source, job_url, description)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(job_url) DO UPDATE SET
             title = excluded.title,
             company = excluded.company,
             location = excluded.location,
             description = excluded.description,
             scraped_at = CURRENT_TIMESTAMP`,
          [job.title, job.company, job.location, job.source, job.job_url, job.description]
        );
      }
    }

    const rows = await db.all('SELECT * FROM jobs ORDER BY id DESC');
    return NextResponse.json({ success: true, count: rows.length, jobs: rows });
  } catch (error: any) {
    console.error('Error fetching/scraping jobs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const keyword = body.keyword || 'intern';

    const db = await getDb();
    const scraped = await scrapeAllJobs(keyword);

    for (const job of scraped) {
      await db.run(
        `INSERT INTO jobs (title, company, location, source, job_url, description)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(job_url) DO UPDATE SET
           title = excluded.title,
           company = excluded.company,
           location = excluded.location,
           description = excluded.description,
           scraped_at = CURRENT_TIMESTAMP`,
        [job.title, job.company, job.location, job.source, job.job_url, job.description]
      );
    }

    const rows = await db.all('SELECT * FROM jobs ORDER BY id DESC');
    return NextResponse.json({ success: true, count: rows.length, jobs: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
