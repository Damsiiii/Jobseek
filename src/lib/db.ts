import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const dbPath = path.join(process.cwd(), 'data.sqlite');
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      await db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA foreign_keys = ON;
      `);

      return db;
    })();
  }
  const db = await dbPromise;
  await initDb(db);
  return db;
}

async function initDb(db: Database) {
  // Settings table (API Keys, preferences)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // User profile table (CV info)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_text TEXT NOT NULL,
      parsed_json TEXT,
      filename TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Scraped Jobs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      source TEXT NOT NULL,
      job_url TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      posted_date TEXT,
      first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: add posted_date and first_seen_at to jobs tables created before they existed
  const jobColumns: Array<{ name: string }> = await db.all('PRAGMA table_info(jobs)');
  if (!jobColumns.some((col) => col.name === 'posted_date')) {
    await db.exec('ALTER TABLE jobs ADD COLUMN posted_date TEXT');
  }
  if (!jobColumns.some((col) => col.name === 'first_seen_at')) {
    await db.exec('ALTER TABLE jobs ADD COLUMN first_seen_at DATETIME');
    await db.exec('UPDATE jobs SET first_seen_at = COALESCE(scraped_at, CURRENT_TIMESTAMP) WHERE first_seen_at IS NULL');
  }

  // Tailored Applications table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      tailored_cv_markdown TEXT NOT NULL,
      cover_letter_markdown TEXT NOT NULL,
      cv_ats_score INTEGER,
      cover_letter_ats_score INTEGER,
      cv_score_json TEXT,
      cover_letter_score_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
  `);

  // Migration: ATS score columns for applications created before scoring existed
  const appColumns: Array<{ name: string }> = await db.all('PRAGMA table_info(applications)');
  const appColNames = new Set(appColumns.map((col) => col.name));
  if (!appColNames.has('cv_ats_score')) {
    await db.exec('ALTER TABLE applications ADD COLUMN cv_ats_score INTEGER');
  }
  if (!appColNames.has('cover_letter_ats_score')) {
    await db.exec('ALTER TABLE applications ADD COLUMN cover_letter_ats_score INTEGER');
  }
  if (!appColNames.has('cv_score_json')) {
    await db.exec('ALTER TABLE applications ADD COLUMN cv_score_json TEXT');
  }
  if (!appColNames.has('cover_letter_score_json')) {
    await db.exec('ALTER TABLE applications ADD COLUMN cover_letter_score_json TEXT');
  }

  // Remote / freelance application documents (pasted job or gig descriptions)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS remote_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT,
      description TEXT NOT NULL,
      engagement_type TEXT NOT NULL,
      tailored_cv_markdown TEXT NOT NULL,
      cover_letter_markdown TEXT NOT NULL,
      proposal_markdown TEXT NOT NULL,
      pitch_markdown TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Remote Scraped Jobs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS remote_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      source TEXT NOT NULL,
      job_url TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      posted_date TEXT,
      first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
