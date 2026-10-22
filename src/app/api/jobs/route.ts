import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scrapeAllJobs } from '@/lib/scrapers';

async function upsertJobs(
  db: Awaited<ReturnType<typeof getDb>>,
  scraped: Awaited<ReturnType<typeof scrapeAllJobs>>
) {
  if (!scraped.length) return;
  await db.run('BEGIN TRANSACTION');
  try {
    for (const job of scraped) {
      await db.run(
        `INSERT INTO jobs (title, company, location, source, job_url, description, posted_date, first_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}

const JOBS_QUERY = `
  SELECT 
    jobs.*,
    CASE WHEN app.job_id IS NOT NULL THEN 1 ELSE 0 END as has_applied,
    app.applied_at
  FROM jobs 
  LEFT JOIN (
    SELECT job_id, MAX(created_at) as applied_at 
    FROM applications 
    GROUP BY job_id
  ) app ON app.job_id = jobs.id
  ORDER BY 
    CASE WHEN LOWER(title) LIKE '%intern%' OR LOWER(title) LIKE '%junior%' OR LOWER(title) LIKE '%trainee%' OR LOWER(title) LIKE '%associate%' THEN 0 ELSE 1 END,
    id DESC
`;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const triggerScrape = searchParams.get('scrape') === 'true';

    const db = await getDb();

    // Scrape without filtering
    if (triggerScrape) {
      const scraped = await scrapeAllJobs();
      await upsertJobs(db, scraped);
    }

    // Query already-scraped jobs from the database
    let rows = await db.all(JOBS_QUERY);

    // Filter already-scraped jobs by CV skills or keyword after scraping
    if (searchParams.get('basedOn') === 'cv') {
      const profileRow = await db.get('SELECT parsed_json FROM profile ORDER BY id DESC LIMIT 1');
      if (profileRow?.parsed_json) {
        try {
          const parsed = JSON.parse(profileRow.parsed_json);
          if (Array.isArray(parsed?.skills) && parsed.skills.length > 0) {
            const skills: string[] = parsed.skills.map((s: string) => s.toLowerCase().trim()).filter(Boolean);
            rows = rows.filter((job) => {
              const text = `${job.title} ${job.company} ${job.description}`.toLowerCase();
              return skills.some((s) => text.includes(s));
            });
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    const keyword = searchParams.get('keyword');
    if (keyword && keyword.trim()) {
      const kw = keyword.toLowerCase().trim();
      rows = rows.filter((job) =>
        `${job.title} ${job.company} ${job.description}`.toLowerCase().includes(kw)
      );
    }

    if (searchParams.get('checkClosed') === 'true') {
      const closedJobs = await findClosedJobs(db);
      return NextResponse.json({ success: true, count: closedJobs.length, closedJobs });
    }

    return NextResponse.json({ success: true, count: rows.length, jobs: rows });
  } catch (error) {
    console.error('Error fetching/scraping jobs:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function isJobClosed(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404 || res.status === 410) return true;
    const html = await res.text();
    return (
      html.includes('closed-job') ||
      /no longer accepting applications|this vacancy has expired|this job has expired|job is closed|application deadline has passed/i.test(html)
    );
  } catch {
    return false;
  }
}

export async function findClosedJobs(db: Awaited<ReturnType<typeof getDb>>) {
  const jobs: Array<{ id: number; title: string; company: string; source: string; job_url: string }> =
    await db.all('SELECT id, title, company, source, job_url FROM jobs ORDER BY id DESC');
  const closedJobs: typeof jobs = [];

  const CONCURRENCY = 10;
  let index = 0;
  async function worker() {
    while (index < jobs.length) {
      const job = jobs[index++];
      if (!job?.job_url) continue;
      if (await isJobClosed(job.job_url)) {
        closedJobs.push(job);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker()));
  return closedJobs;
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const idsParam = searchParams.get('ids');
    const cleanClosed = searchParams.get('cleanClosed') === 'true';
    const db = await getDb();

    if (id) {
      const job = await db.get('SELECT id, title, company, source, job_url FROM jobs WHERE id = ?', [id]);
      await db.run('DELETE FROM applications WHERE job_id = ?', [id]);
      await db.run('DELETE FROM jobs WHERE id = ?', [id]);
      return NextResponse.json({ success: true, removedCount: 1, removedJobs: job ? [job] : [] });
    }

    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter((n) => !isNaN(n) && n > 0);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const removedJobs = await db.all(`SELECT id, title, company, source, job_url FROM jobs WHERE id IN (${placeholders})`, ids);
        await db.run(`DELETE FROM applications WHERE job_id IN (${placeholders})`, ids);
        await db.run(`DELETE FROM jobs WHERE id IN (${placeholders})`, ids);
        return NextResponse.json({ success: true, removedCount: ids.length, removedJobs });
      }
    }

    if (cleanClosed) {
      const closedJobs = await findClosedJobs(db);
      if (closedJobs.length > 0) {
        const ids = closedJobs.map((j) => j.id);
        const placeholders = ids.map(() => '?').join(',');
        await db.run(`DELETE FROM applications WHERE job_id IN (${placeholders})`, ids);
        await db.run(`DELETE FROM jobs WHERE id IN (${placeholders})`, ids);
      }
      return NextResponse.json({ success: true, removedCount: closedJobs.length, removedJobs: closedJobs });
    }

    return NextResponse.json({ success: false, error: 'Missing id, ids, or cleanClosed parameter' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
