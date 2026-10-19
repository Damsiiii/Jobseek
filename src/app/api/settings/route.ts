import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT key, value FROM settings');
    const settingsObj: Record<string, string> = {};
    for (const r of rows) {
      settingsObj[r.key] = r.value;
    }
    return NextResponse.json({ success: true, settings: settingsObj });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { key, value } = body;
    if (!key) {
      return NextResponse.json({ success: false, error: 'Key is required' }, { status: 400 });
    }

    const db = await getDb();
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, String(value ?? '')]
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
