import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTailoredApplication } from '@/lib/llm';

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 });
    }

    const db = await getDb();

    // Get candidate profile
    const profileRow = await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    if (!profileRow) {
      return NextResponse.json(
        { success: false, error: 'Please upload your CV profile first before tailoring.' },
        { status: 400 }
      );
    }

    // Get job details
    const jobRow = await db.get('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (!jobRow) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    // Generate tailored CV and cover letter using LLM / intelligent customizer
    const { tailoredCv, coverLetter } = await generateTailoredApplication(
      profileRow.raw_text,
      jobRow.title,
      jobRow.company,
      jobRow.description
    );

    // Save to database
    const result = await db.run(
      `INSERT INTO applications (job_id, tailored_cv_markdown, cover_letter_markdown)
       VALUES (?, ?, ?)`,
      [jobId, tailoredCv, coverLetter]
    );

    return NextResponse.json({
      success: true,
      applicationId: result.lastID,
      job: jobRow,
      tailoredCv,
      coverLetter,
    });
  } catch (error: any) {
    console.error('Error generating application:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    const db = await getDb();
    if (jobId) {
      const row = await db.get('SELECT * FROM applications WHERE job_id = ? ORDER BY id DESC LIMIT 1', [jobId]);
      return NextResponse.json({ success: true, application: row || null });
    } else {
      const rows = await db.all(
        `SELECT a.*, j.title, j.company, j.location, j.source
         FROM applications a
         JOIN jobs j ON a.job_id = j.id
         ORDER BY a.id DESC`
      );
      return NextResponse.json({ success: true, applications: rows });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
