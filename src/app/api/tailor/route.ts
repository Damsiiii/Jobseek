import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateTailoredApplication } from '@/lib/llm';
import { scoreApplicationDocs } from '@/lib/atsScore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, applicationId, regenerate, optimizationContext } = body;

    const db = await getDb();

    let effectiveJobId = jobId;
    if (!effectiveJobId && applicationId) {
      const existingApp = await db.get('SELECT job_id FROM applications WHERE id = ?', [applicationId]);
      effectiveJobId = existingApp?.job_id;
    }

    if (!effectiveJobId) {
      return NextResponse.json({ success: false, error: 'jobId or applicationId is required' }, { status: 400 });
    }

    // Get candidate profile
    const profileRow = await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    if (!profileRow) {
      return NextResponse.json(
        { success: false, error: 'Please upload your CV profile first before tailoring.' },
        { status: 400 }
      );
    }

    // Get job details
    const jobRow = await db.get('SELECT * FROM jobs WHERE id = ?', [effectiveJobId]);
    if (!jobRow) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    // Generate tailored CV and cover letter using LLM / intelligent customizer
    const { tailoredCv, coverLetter } = await generateTailoredApplication(
      profileRow.raw_text,
      jobRow.title,
      jobRow.company,
      jobRow.description,
      regenerate ? optimizationContext : undefined
    );

    const scores = await scoreApplicationDocs(
      tailoredCv,
      coverLetter,
      jobRow.title,
      jobRow.company,
      jobRow.description
    );

    let finalAppId = applicationId;
    if (applicationId) {
      // In-place regeneration update
      await db.run(
        `UPDATE applications SET
           tailored_cv_markdown = ?,
           cover_letter_markdown = ?,
           cv_ats_score = ?,
           cover_letter_ats_score = ?,
           cv_score_json = ?,
           cover_letter_score_json = ?
         WHERE id = ?`,
        [
          tailoredCv,
          coverLetter,
          scores.cv.score,
          scores.coverLetter.score,
          JSON.stringify(scores.cv),
          JSON.stringify(scores.coverLetter),
          applicationId,
        ]
      );
    } else {
      // Initial generation insert
      const result = await db.run(
        `INSERT INTO applications (
          job_id, tailored_cv_markdown, cover_letter_markdown,
          cv_ats_score, cover_letter_ats_score, cv_score_json, cover_letter_score_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          effectiveJobId,
          tailoredCv,
          coverLetter,
          scores.cv.score,
          scores.coverLetter.score,
          JSON.stringify(scores.cv),
          JSON.stringify(scores.coverLetter),
        ]
      );
      finalAppId = result.lastID;
    }

    return NextResponse.json({
      success: true,
      applicationId: finalAppId,
      job: jobRow,
      tailoredCv,
      coverLetter,
      scores,
      previousScores: optimizationContext?.scores,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating application:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
