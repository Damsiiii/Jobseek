import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deriveSearchKeywords } from '../src/lib/scrapers/cvKeywords.ts';
import { toIsoDate, isRecentlyScraped } from '../src/lib/scrapers/dateUtils.ts';
import { extractCandidateName, extractCandidateContact } from '../src/lib/cvParser.ts';

describe('deriveSearchKeywords', () => {
  test('prioritizes core frameworks/languages over generic skills', () => {
    const skills = ['Git', 'HTML', 'CSS', 'Python', 'React', 'Docker'];
    const keywords = deriveSearchKeywords(skills, 3);
    assert.deepEqual(keywords, ['Python', 'React', 'Docker']);
  });

  test('filters out skipped skills like HTML, CSS, Git, Agile', () => {
    const skills = ['HTML', 'CSS', 'Git', 'Agile', 'Scrum'];
    const keywords = deriveSearchKeywords(skills);
    assert.deepEqual(keywords, ['intern']);
  });

  test('falls back to custom fallback keyword when empty', () => {
    assert.deepEqual(deriveSearchKeywords([], 3, 'developer'), ['developer']);
  });
});

describe('toIsoDate', () => {
  test('parses plain ISO date', () => {
    assert.equal(toIsoDate('2026-10-15'), '2026-10-15');
    assert.equal(toIsoDate('Posted on 2026-05-01'), '2026-05-01');
  });

  test('parses relative dates with ago', () => {
    const res = toIsoDate('3 days ago');
    assert.ok(res && /^\d{4}-\d{2}-\d{2}$/.test(res));

    const resWeeks = toIsoDate('Posted 2 weeks ago');
    assert.ok(resWeeks && /^\d{4}-\d{2}-\d{2}$/.test(resWeeks));
  });

  test('does not misparse job duration or weekly hours as posted dates', () => {
    assert.equal(toIsoDate('6 months internship'), null);
    assert.equal(toIsoDate('40 hours per week'), null);
    assert.equal(toIsoDate('duration: 3 months'), null);
  });

  test('handles today and yesterday', () => {
    assert.ok(toIsoDate('today'));
    assert.ok(toIsoDate('yesterday'));
  });
});

describe('isRecentlyScraped', () => {
  test('returns true for timestamps within 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    assert.equal(isRecentlyScraped(twoHoursAgo), true);
  });

  test('returns false for timestamps older than default 24 hours', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString();
    assert.equal(isRecentlyScraped(twoDaysAgo), false);
  });

  test('supports custom maxHours for 7 days and 30 days freshness filters', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600000).toISOString();
    assert.equal(isRecentlyScraped(fiveDaysAgo, 24), false);
    assert.equal(isRecentlyScraped(fiveDaysAgo, 168), true);

    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 3600000).toISOString();
    assert.equal(isRecentlyScraped(twentyDaysAgo, 168), false);
    assert.equal(isRecentlyScraped(twentyDaysAgo, 720), true);
  });

  test('handles future timezone skew within 24 hours', () => {
    const twoHoursAhead = new Date(Date.now() + 2 * 3600000).toISOString();
    assert.equal(isRecentlyScraped(twoHoursAhead, 24), true);
  });

  test('handles null, undefined, and SQLite space-separated formats', () => {
    assert.equal(isRecentlyScraped(null), false);
    assert.equal(isRecentlyScraped(undefined), false);
    assert.equal(isRecentlyScraped('invalid-date'), false);
    const recentSqlite = new Date(Date.now() - 3600000).toISOString().replace('T', ' ').slice(0, 19);
    assert.equal(isRecentlyScraped(recentSqlite), true);
  });
});

describe('Candidate name and contact extraction', () => {
  test('extracts title-case and all-caps candidate names properly', () => {
    const cvAllcaps = 'KAMAL PERERA\nSoftware Engineer\nkamal@example.com';
    assert.equal(extractCandidateName(cvAllcaps), 'KAMAL PERERA');

    const cvTitle = 'Damsara Dissanayaka\nFull Stack Developer';
    assert.equal(extractCandidateName(cvTitle), 'Damsara Dissanayaka');

    const cvHeader = 'CURRICULUM VITAE\nNimal Silva\nUndergraduate';
    assert.equal(extractCandidateName(cvHeader), 'Nimal Silva');
  });

  test('extracts Sri Lankan mobile formats without falling back to placeholder', () => {
    const cv1 = 'Kamal Perera\n+94 77 123 4567\nkamal@example.com';
    const c1 = extractCandidateContact(cv1);
    assert.equal(c1.phone, '+94 77 123 4567');
    assert.equal(c1.email, 'kamal@example.com');
    assert.equal(c1.candidateName, 'Kamal Perera');

    const cv2 = 'Nimal Perera\n0771234567\nnimal@gmail.com';
    const c2 = extractCandidateContact(cv2);
    assert.equal(c2.phone, '0771234567');

    const cv3 = 'Sunil Silva\n+94712345678\nsunil@gmail.com';
    const c3 = extractCandidateContact(cv3);
    assert.equal(c3.phone, '+94712345678');
  });
});
