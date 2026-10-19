import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import PDFParser from 'pdf2json';

export async function GET() {
  try {
    const db = await getDb();
    const profileRow = await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    if (!profileRow) {
      return NextResponse.json({ success: true, profile: null });
    }
    return NextResponse.json({
      success: true,
      profile: {
        id: profileRow.id,
        raw_text: profileRow.raw_text,
        parsed_json: profileRow.parsed_json ? JSON.parse(profileRow.parsed_json) : null,
        filename: profileRow.filename,
        updated_at: profileRow.updated_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let text = '';
    let filename = '';

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (file) {
        filename = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        text = await extractPdfText(buffer);
      } else if (formData.get('text')) {
        text = String(formData.get('text'));
        filename = String(formData.get('filename') || 'Pasted CV');
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.text) {
        text = body.text;
        filename = body.filename || 'Pasted CV';
      }
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'No text extracted from PDF or provided text.' }, { status: 400 });
    }

    // Structural extraction
    const parsedStructure = extractProfileInfo(text);

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO profile (raw_text, parsed_json, filename) VALUES (?, ?, ?)',
      [text, JSON.stringify(parsedStructure), filename]
    );

    return NextResponse.json({
      success: true,
      profile: {
        id: result.lastID,
        raw_text: text,
        parsed_json: parsedStructure,
        filename,
      },
    });
  } catch (error: any) {
    console.error('Error processing CV:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.parseBuffer(buffer);
  });
}

function extractProfileInfo(text: string) {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);

  const commonSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
    'React', 'Next.js', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
    'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'Sass',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Firebase', 'Redis',
    'Git', 'GitHub', 'Docker', 'AWS', 'Azure', 'GCP', 'Linux',
    'REST API', 'GraphQL', 'Machine Learning', 'Data Analysis', 'Agile', 'Scrum'
  ];

  const foundSkills = commonSkills.filter(skill => {
    const escaped = skill.replace(/[\.\+\#]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });

  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    linkedin: linkedinMatch ? linkedinMatch[0] : null,
    github: githubMatch ? githubMatch[0] : null,
    skills: foundSkills,
    summary: text.slice(0, 400).trim(),
  };
}
