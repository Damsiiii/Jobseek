import { GoogleGenAI } from '@google/genai';
import { getDb } from './db';

export type DocScore = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  tips: string[];
};

export type ApplicationScores = {
  cv: DocScore;
  coverLetter: DocScore;
};

const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
  'React', 'Next.js', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
  'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'Sass',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Firebase', 'Redis',
  'Git', 'GitHub', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Linux',
  'REST API', 'GraphQL', 'Machine Learning', 'Data Analysis', 'Agile', 'Scrum',
  'CI/CD', 'Jest', 'Testing', 'Microservices', 'API',
];

const STOPWORDS = new Set(
  [
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that',
    'these', 'those', 'it', 'its', 'we', 'you', 'our', 'your', 'they', 'their',
    'will', 'can', 'may', 'must', 'should', 'have', 'has', 'had', 'do', 'does',
    'did', 'not', 'no', 'all', 'any', 'more', 'most', 'other', 'some', 'such',
    'than', 'too', 'very', 'just', 'about', 'into', 'over', 'after', 'before',
    'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'who', 'whom', 'which', 'what', 'if', 'else',
    'also', 'only', 'own', 'same', 'so', 'up', 'out', 'off', 'down', 'both',
    'each', 'few', 'through', 'during', 'above', 'below', 'job', 'role', 'position',
    'internship', 'intern', 'opportunity', 'company', 'team', 'work', 'working',
    'candidate', 'required', 'requirements', 'preferred', 'experience', 'years',
    'year', 'etc', 'including', 'using', 'use', 'used', 'strong', 'good', 'well',
    'able', 'ability', 'skills', 'skill', 'knowledge', 'looking', 'join', 'please',
    'apply', 'application', 'applications', 'description', 'responsibilities',
  ].map((w) => w.toLowerCase())
);

async function getApiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  const db = await getDb();
  const setting = await db.get("SELECT value FROM settings WHERE key = 'gemini_api_key'");
  return setting ? setting.value : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsKeyword(text: string, keyword: string): boolean {
  const escaped = escapeRegExp(keyword);
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Extract JD keywords from known skills, title tokens, and significant JD words. */
export function extractJdKeywords(jobTitle: string, jobDescription: string): string[] {
  const corpus = `${jobTitle}\n${jobDescription}`;
  const found: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key) || STOPWORDS.has(key)) return;
    seen.add(key);
    found.push(trimmed);
  };

  for (const skill of COMMON_SKILLS) {
    if (containsKeyword(corpus, skill)) {
      pushUnique(skill);
    }
  }

  // Multi-word tech-ish phrases from JD (e.g. "machine learning", "rest api")
  const phraseMatches = corpus.match(/\b[A-Za-z][A-Za-z0-9+#.]*(?:\s+[A-Za-z][A-Za-z0-9+#.]*){1,2}\b/g) || [];
  for (const phrase of phraseMatches) {
    const words = phrase.split(/\s+/);
    if (words.every((w) => STOPWORDS.has(w.toLowerCase()))) continue;
    if (words.some((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()))) {
      // Prefer known skills already captured; only keep short technical phrases
      if (phrase.length <= 40 && /[A-Z+#.]|[a-z]{4,}/.test(phrase)) {
        const looksTechnical =
          COMMON_SKILLS.some((s) => s.toLowerCase() === phrase.toLowerCase()) ||
          /\b(api|sdk|cloud|data|web|full[\s-]?stack|front[\s-]?end|back[\s-]?end|devops|testing)\b/i.test(
            phrase
          );
        if (looksTechnical) pushUnique(phrase);
      }
    }
  }

  // Significant title tokens
  for (const token of jobTitle.split(/[\s,/|]+/)) {
    const t = token.replace(/[^A-Za-z0-9+#.]/g, '');
    if (t.length >= 3 && !STOPWORDS.has(t.toLowerCase())) {
      pushUnique(t);
    }
  }

  // Significant single tokens from JD (capitalized or longer tech-looking words)
  const tokens = jobDescription.match(/\b[A-Za-z][A-Za-z0-9+#.]*\b/g) || [];
  for (const token of tokens) {
    if (token.length < 4) continue;
    if (STOPWORDS.has(token.toLowerCase())) continue;
    if (/^[A-Z]/.test(token) || /(?:js|sql|api|db|ui|ux)$/i.test(token)) {
      pushUnique(token);
    }
  }

  return found.slice(0, 40);
}

function splitMatchedMissing(text: string, keywords: string[]) {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    if (containsKeyword(text, kw)) matched.push(kw);
    else missing.push(kw);
  }
  return { matched, missing };
}

type StructureIssue = { id: string; tip: string; ok: boolean };

function evaluateCvStructure(cv: string): { structureScore: number; issues: StructureIssue[] } {
  const issues: StructureIssue[] = [];
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cv);
  const hasPhone =
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/.test(cv);
  issues.push({
    id: 'contact',
    tip: 'Add a clear contact line with email and phone so ATS parsers can extract them.',
    ok: hasEmail && hasPhone,
  });

  const hasSummary = /#{1,3}\s*(professional\s+)?summary|profile|objective/i.test(cv);
  issues.push({
    id: 'summary',
    tip: 'Include a Professional Summary section with role-aligned keywords.',
    ok: hasSummary,
  });

  const hasSkills = /#{1,3}\s*.*skills/i.test(cv);
  issues.push({
    id: 'skills',
    tip: 'Add a dedicated Skills section listing technologies from the job description.',
    ok: hasSkills,
  });

  const hasExperience =
    /#{1,3}\s*.*(experience|projects|work\s+history|employment)/i.test(cv);
  issues.push({
    id: 'experience',
    tip: 'Include Experience or Projects with concrete, keyword-rich bullet points.',
    ok: hasExperience,
  });

  const hasEducation = /#{1,3}\s*.*education/i.test(cv);
  issues.push({
    id: 'education',
    tip: 'Add an Education section for standard ATS section coverage.',
    ok: hasEducation,
  });

  const hasTable = /\|.+\|/.test(cv) || /<table/i.test(cv);
  issues.push({
    id: 'tables',
    tip: 'Avoid tables and multi-column layouts; use a single-column ATS-friendly format.',
    ok: !hasTable,
  });

  const words = wordCount(cv);
  const lengthOk = words >= 150 && words <= 1200;
  issues.push({
    id: 'length',
    tip: 'Keep the CV concise (roughly one to two pages of focused content).',
    ok: lengthOk,
  });

  const passed = issues.filter((i) => i.ok).length;
  const structureScore = Math.round((passed / issues.length) * 100);
  return { structureScore, issues };
}

function evaluateCoverLetterContent(
  coverLetter: string,
  jobTitle: string,
  companyName: string
): { contentScore: number; issues: StructureIssue[] } {
  const issues: StructureIssue[] = [];
  const lower = coverLetter.toLowerCase();

  const mentionsCompany =
    companyName.trim().length > 0 && lower.includes(companyName.trim().toLowerCase());
  issues.push({
    id: 'company',
    tip: `Mention ${companyName.trim() || 'the company'} by name in the cover letter.`,
    ok: mentionsCompany,
  });

  const titleWords = jobTitle
    .split(/[\s,/|]+/)
    .map((w) => w.replace(/[^A-Za-z0-9+#.]/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()));
  const mentionsTitle =
    containsKeyword(coverLetter, jobTitle) ||
    (titleWords.length > 0 && titleWords.every((w) => containsKeyword(coverLetter, w)));
  issues.push({
    id: 'title',
    tip: `Reference the ${jobTitle} role explicitly.`,
    ok: mentionsTitle,
  });

  const words = wordCount(coverLetter);
  const lengthOk = words >= 150 && words <= 450;
  issues.push({
    id: 'length',
    tip: 'Aim for roughly 150–450 words so the letter is complete but skimmable.',
    ok: lengthOk,
  });

  const hasGreeting = /\b(dear|hello|hi)\b/i.test(coverLetter);
  issues.push({
    id: 'greeting',
    tip: 'Start with a professional greeting (e.g. Dear Hiring Manager).',
    ok: hasGreeting,
  });

  const hasClosing = /\b(sincerely|regards|best regards|yours truly|thank you)\b/i.test(
    coverLetter
  );
  issues.push({
    id: 'closing',
    tip: 'End with a professional closing and your name.',
    ok: hasClosing,
  });

  const passed = issues.filter((i) => i.ok).length;
  const contentScore = Math.round((passed / issues.length) * 100);
  return { contentScore, issues };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreCv(
  tailoredCv: string,
  keywords: string[]
): Omit<DocScore, 'tips'> & { issues: StructureIssue[] } {
  const { matched, missing } = splitMatchedMissing(tailoredCv, keywords);
  const keywordScore =
    keywords.length === 0 ? 70 : Math.round((matched.length / keywords.length) * 100);
  const { structureScore, issues } = evaluateCvStructure(tailoredCv);
  const score = clampScore(keywordScore * 0.7 + structureScore * 0.3);
  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    issues,
  };
}

function scoreCoverLetter(
  coverLetter: string,
  keywords: string[],
  jobTitle: string,
  companyName: string
): Omit<DocScore, 'tips'> & { issues: StructureIssue[] } {
  const { matched, missing } = splitMatchedMissing(coverLetter, keywords);
  const keywordScore =
    keywords.length === 0 ? 65 : Math.round((matched.length / keywords.length) * 100);
  const { contentScore, issues } = evaluateCoverLetterContent(
    coverLetter,
    jobTitle,
    companyName
  );
  const score = clampScore(keywordScore * 0.6 + contentScore * 0.4);
  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    issues,
  };
}

function buildFallbackTips(
  missingKeywords: string[],
  issues: StructureIssue[],
  max = 4
): string[] {
  const tips: string[] = [];
  for (const issue of issues) {
    if (!issue.ok) tips.push(issue.tip);
  }
  const topMissing = missingKeywords.slice(0, 5);
  if (topMissing.length > 0) {
    tips.push(`Weave in missing keywords where truthful: ${topMissing.join(', ')}.`);
  }
  if (tips.length === 0) {
    tips.push('Documents look well aligned; keep wording natural and truthful.');
  }
  return tips.slice(0, max);
}

async function fetchLlmTips(params: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  tailoredCv: string;
  coverLetter: string;
  cvMissing: string[];
  clMissing: string[];
}): Promise<{ cvTips: string[]; coverLetterTips: string[] } | null> {
  const apiKey = await getApiKey();
  if (!apiKey?.trim()) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are an ATS resume coach. Given a job and the candidate's tailored CV and cover letter, suggest short improvement tips.
Do NOT invent credentials. Only suggest rephrasing, keyword placement, and structure fixes.
Return ONLY valid JSON (no markdown fences):
{"cvTips":["..."],"coverLetterTips":["..."]}
Max 4 tips each. Each tip under 120 characters.

Job title: ${params.jobTitle}
Company: ${params.companyName}
Job description (excerpt):
"""
${params.jobDescription.slice(0, 2500)}
"""

Missing CV keywords: ${params.cvMissing.slice(0, 12).join(', ') || 'none'}
Missing cover letter keywords: ${params.clMissing.slice(0, 12).join(', ') || 'none'}

CV (excerpt):
"""
${params.tailoredCv.slice(0, 3000)}
"""

Cover letter (excerpt):
"""
${params.coverLetter.slice(0, 2000)}
"""
`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM tips call timed out after 5s')), 5000)
    );

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      }),
      timeoutPromise,
    ]);

    const text = (response.text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      cvTips?: unknown;
      coverLetterTips?: unknown;
    };

    const normalize = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim())
        .slice(0, 4);
    };

    const cvTips = normalize(parsed.cvTips);
    const coverLetterTips = normalize(parsed.coverLetterTips);
    if (cvTips.length === 0 && coverLetterTips.length === 0) return null;
    return { cvTips, coverLetterTips };
  } catch (err) {
    console.warn('ATS tips LLM call failed, using fallback tips:', err);
    return null;
  }
}

export async function scoreApplicationDocs(
  tailoredCv: string,
  coverLetter: string,
  jobTitle: string,
  companyName: string,
  jobDescription: string
): Promise<ApplicationScores> {
  const keywords = extractJdKeywords(jobTitle, jobDescription);
  const cvBase = scoreCv(tailoredCv, keywords);
  const clBase = scoreCoverLetter(coverLetter, keywords, jobTitle, companyName);

  const llmTips = await fetchLlmTips({
    jobTitle,
    companyName,
    jobDescription,
    tailoredCv,
    coverLetter,
    cvMissing: cvBase.missingKeywords,
    clMissing: clBase.missingKeywords,
  });

  const cvTips =
    llmTips?.cvTips?.length
      ? llmTips.cvTips
      : buildFallbackTips(cvBase.missingKeywords, cvBase.issues);
  const coverLetterTips =
    llmTips?.coverLetterTips?.length
      ? llmTips.coverLetterTips
      : buildFallbackTips(clBase.missingKeywords, clBase.issues);

  return {
    cv: {
      score: cvBase.score,
      matchedKeywords: cvBase.matchedKeywords,
      missingKeywords: cvBase.missingKeywords,
      tips: cvTips,
    },
    coverLetter: {
      score: clBase.score,
      matchedKeywords: clBase.matchedKeywords,
      missingKeywords: clBase.missingKeywords,
      tips: coverLetterTips,
    },
  };
}
