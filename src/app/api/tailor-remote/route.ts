import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateRemoteApplication, type EngagementType } from '@/lib/llm';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, company, description, engagementType } = body as {
      title?: string;
      company?: string;
      description?: string;
      engagementType?: EngagementType;
    };

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { success: false, error: 'title and description are required' },
        { status: 400 }
      );
    }

    if (engagementType !== 'remote' && engagementType !== 'freelance') {
      return NextResponse.json(
        { success: false, error: "engagementType must be 'remote' or 'freelance'" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const profileRow = await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    if (!profileRow) {
      return NextResponse.json(
        { success: false, error: 'Please upload your CV profile first before generating documents.' },
        { status: 400 }
      );
    }

    const companyName = typeof company === 'string' ? company.trim() : '';
    const docs = await generateRemoteApplication(
      profileRow.raw_text,
      title.trim(),
      companyName,
      description.trim(),
      engagementType
    );

    const result = await db.run(
      `INSERT INTO remote_applications (
        title, company, description, engagement_type,
        tailored_cv_markdown, cover_letter_markdown, proposal_markdown, pitch_markdown
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        companyName || null,
        description.trim(),
        engagementType,
        docs.tailoredCv,
        docs.coverLetter,
        docs.proposal,
        docs.pitch,
      ]
    );

    return NextResponse.json({
      success: true,
      applicationId: result.lastID,
      title: title.trim(),
      company: companyName || null,
      engagementType,
      tailoredCv: docs.tailoredCv,
      coverLetter: docs.coverLetter,
      proposal: docs.proposal,
      pitch: docs.pitch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating remote application:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const db = await getDb();

    if (id) {
      const row = await db.get('SELECT * FROM remote_applications WHERE id = ?', [id]);
      if (!row) {
        return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, application: row });
    }

    const rows = await db.all(
      'SELECT * FROM remote_applications ORDER BY created_at DESC LIMIT 50'
    );
    return NextResponse.json({ success: true, applications: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching remote applications:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
