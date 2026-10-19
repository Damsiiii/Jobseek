import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scrapeAllJobs } from '@/lib/scrapers';
import { deriveSearchKeywords } from '@/lib/scrapers/cvKeywords';

/**
 * Resolves the keywords to search for. When `basedOn === 'cv'`, keywords
 * are derived from the skills detected in the uploaded CV profile;
 * otherwise a single `keyword` query param (default "intern") is used.
 */
async function resolveKeywords(searchParams: URLSearchParams): Promise<string[]> {
  if (searchParams.get('basedOn') === 'cv') {
    const db = await getDb();
    const profileRow = await db.get('SELECT parsed_json FROM profile ORDER BY id DESC LIMIT 1');
    if (profileRow?.parsed_json) {
      try {
        const parsed = JSON.parse(profileRow.parsed_json);
        if (Array.isArray(parsed?.skills) && parsed.skills.length > 0) {
          return deriveSearchKeywords(parsed.skills);
        }
      } catch {
        // fall through to default keyword
      }
    }
  }
  return [searchParams.get('keyword') || 'intern'];
}

async function upsertJobs(
  db: Awaited<ReturnType<typeof getDb>>,
  scraped: Awaited<ReturnType<typeof scrapeAllJobs>>
) {
  for (const job of scraped) {
    await db.run(
      `INSERT INTO jobs (title, company, location, source, job_url, description, posted_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(job_url) DO UPDATE SET
         title = excluded.title,
         company = excluded.company,
         location = excluded.location,
         description = excluded.description,
         posted_date = COALESCE(excluded.posted_date, jobs.posted_date),
         scraped_at = CURRENT_TIMESTAMP`,
      [job.title, job.company, job.location, job.source, job.job_url, job.description, job.posted_date ?? null]
    );
  }
}

const JOBS_QUERY = `
  SELECT * FROM jobs 
  WHERE NOT (
    title LIKE '%senior%' OR title LIKE '%lead%' OR title LIKE '%principal%' 
    OR title LIKE '%architect%' OR title LIKE '%manager%' OR title LIKE '%director%' 
    OR title LIKE '%head%'
  )
  ORDER BY 
    CASE WHEN LOWER(title) LIKE '%intern%' OR LOWER(title) LIKE '%junior%' OR LOWER(title) LIKE '%trainee%' OR LOWER(title) LIKE '%associate%' THEN 0 ELSE 1 END,
    id DESC
`;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const triggerScrape = searchParams.get('scrape') === 'true';
    const keywords = await resolveKeywords(searchParams);

    const db = await getDb();

    if (triggerScrape) {
      const scraped = await scrapeAllJobs(keywords);
      await upsertJobs(db, scraped);
    }

    const rows = await db.all(JOBS_QUERY);
    return NextResponse.json({ success: true, count: rows.length, keywords, jobs: rows });
  } catch (error) {
    console.error('Error fetching/scraping jobs:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const db = await getDb();
    let keywords: string[] = [body.keyword || 'intern'];
    if (body.basedOn === 'cv') {
      const profileRow = await db.get('SELECT parsed_json FROM profile ORDER BY id DESC LIMIT 1');
      if (profileRow?.parsed_json) {
        try {
          const parsed = JSON.parse(profileRow.parsed_json);
          if (Array.isArray(parsed?.skills) && parsed.skills.length > 0) {
            keywords = deriveSearchKeywords(parsed.skills);
          }
        } catch {
          // keep default keyword
        }
      }
    }

    const scraped = await scrapeAllJobs(keywords);
    await upsertJobs(db, scraped);

    const rows = await db.all(JOBS_QUERY);
    return NextResponse.json({ success: true, count: rows.length, keywords, jobs: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
