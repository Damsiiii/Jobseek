import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scrapeRemoteJobs } from '@/lib/scrapers/remoteJobs';
import { deriveSearchKeywords } from '@/lib/scrapers/cvKeywords';

async function resolveRemoteKeyword(searchParams: URLSearchParams): Promise<string> {
  const param = searchParams.get('keyword');
  if (param && param.trim()) return param.trim();

  // If basedOn=cv or no keyword provided, try getting primary skill from uploaded CV
  const db = await getDb();
  const profileRow = await db.get('SELECT parsed_json FROM profile ORDER BY id DESC LIMIT 1');
  if (profileRow?.parsed_json) {
    try {
      const parsed = JSON.parse(profileRow.parsed_json);
      if (Array.isArray(parsed?.skills) && parsed.skills.length > 0) {
        const keywords = deriveSearchKeywords(parsed.skills, 1, 'developer');
        if (keywords.length > 0) return keywords[0];
      }
    } catch {
      // ignore JSON parse error
    }
  }
  return '';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const triggerScrape = searchParams.get('scrape') === 'true';
    const keyword = await resolveRemoteKeyword(searchParams);

    const db = await getDb();

    // Check count of existing remote jobs
    const countRow = await db.get('SELECT COUNT(*) as count FROM remote_jobs');
    const existingCount = Number(countRow?.count || 0);

    // Scrape if requested OR if database is completely empty
    if (triggerScrape || existingCount === 0) {
      const scraped = await scrapeRemoteJobs(keyword);
      if (scraped.length > 0) {
        await db.run('BEGIN TRANSACTION');
        try {
          for (const job of scraped) {
            await db.run(
              `INSERT INTO remote_jobs (title, company, location, source, job_url, description, posted_date, first_seen_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(job_url) DO UPDATE SET
                 title = excluded.title,
                 company = excluded.company,
                 location = excluded.location,
                 description = excluded.description,
                 posted_date = COALESCE(excluded.posted_date, remote_jobs.posted_date),
                 scraped_at = CURRENT_TIMESTAMP`,
              [
                job.title,
                job.company,
                job.location,
                job.source,
                job.job_url,
                job.description,
                job.posted_date ?? null,
              ]
            );
          }
          await db.run('COMMIT');
        } catch (err) {
          await db.run('ROLLBACK');
          throw err;
        }
      }
    }

    const rows = await db.all(
      'SELECT * FROM remote_jobs ORDER BY id DESC LIMIT 100'
    );

    return NextResponse.json({
      success: true,
      count: rows.length,
      keyword,
      jobs: rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching remote jobs:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
