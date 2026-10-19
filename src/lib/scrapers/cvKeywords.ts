/**
 * Derives job-board search keywords from the skills detected in the
 * candidate's CV. Skills that make poor standalone search queries
 * (generic tools/concepts) are skipped, and results are ordered by
 * how useful they typically are as search terms.
 */

const SKIPPED_SKILLS = new Set(
  [
    'HTML', 'CSS', 'Bootstrap', 'Sass', 'Git', 'GitHub', 'Agile', 'Scrum',
    'REST API', 'Data Analysis', 'Problem Solving', 'Linux',
  ].map((s) => s.toLowerCase())
);

const PRIORITY_ORDER = [
  // Role-defining languages/frameworks first
  'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Next.js', 'Node.js',
  'Angular', 'Vue', 'Django', 'Flask', 'Spring', 'Go', 'Rust', 'C++', 'C#',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Docker', 'Kubernetes', 'AWS',
  'Azure', 'GCP', 'Machine Learning', 'GraphQL', 'Redis', 'Firebase',
];

/**
 * Returns up to `max` search keywords derived from the CV skills.
 * Falls back to `[fallback]` when nothing useful is found (default: intern).
 */
export function deriveSearchKeywords(
  skills: string[],
  max = 3,
  fallback = 'intern'
): string[] {
  const usable = skills.filter((s) => s && !SKIPPED_SKILLS.has(s.trim().toLowerCase()));
  if (usable.length === 0) return [fallback];

  const sorted = [...usable].sort((a, b) => {
    const ia = PRIORITY_ORDER.findIndex((p) => p.toLowerCase() === a.trim().toLowerCase());
    const ib = PRIORITY_ORDER.findIndex((p) => p.toLowerCase() === b.trim().toLowerCase());
    return (ia === -1 ? PRIORITY_ORDER.length : ia) - (ib === -1 ? PRIORITY_ORDER.length : ib);
  });

  const keywords = sorted.slice(0, max).map((s) => s.trim());
  return keywords.length > 0 ? keywords : [fallback];
}
