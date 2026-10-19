import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const dbPath = path.join(process.cwd(), 'data.sqlite');
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await initDb(dbInstance);
  return dbInstance;
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
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: add posted_date to jobs tables created before it existed
  const jobColumns: Array<{ name: string }> = await db.all('PRAGMA table_info(jobs)');
  if (!jobColumns.some((col) => col.name === 'posted_date')) {
    await db.exec('ALTER TABLE jobs ADD COLUMN posted_date TEXT');
  }

  // Tailored Applications table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      tailored_cv_markdown TEXT NOT NULL,
      cover_letter_markdown TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
  `);
}
