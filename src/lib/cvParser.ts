export function extractCandidateName(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const skipKeywords = /^(curriculum vitae|resume|cv|biodata|personal profile|profile|portfolio)$/i;
  for (const line of lines.slice(0, 8)) {
    if (skipKeywords.test(line)) continue;
    if (line.includes('@') || line.includes('http') || line.includes('www.') || line.includes('|')) continue;
    if (/^[A-Za-z][A-Za-z.\s\-']{2,45}$/.test(line)) {
      const words = line.split(/\s+/);
      if (
        words.length >= 1 &&
        words.length <= 5 &&
        !/^(software|developer|engineer|intern|undergraduate|student)$/i.test(words[0])
      ) {
        return line;
      }
    }
  }
  return 'Candidate Name';
}

export function extractCandidateContact(candidateCV: string) {
  const candidateName = extractCandidateName(candidateCV);
  const emailMatch = candidateCV.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : 'candidate@email.com';
  const phoneMatch = candidateCV.match(
    /(?:\+?94[-.\s]?|0)7[0-8]\d[-.\s]?\d{3}[-.\s]?\d{3,4}|(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/
  );
  const phone = phoneMatch ? phoneMatch[0] : 'Contact Number';
  return { candidateName, email, phone };
}

export function extractProfileInfo(text: string) {
  const { candidateName, email, phone } = extractCandidateContact(text);
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);

  const commonSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
    'React', 'Next.js', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
    'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'Sass',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'Firebase', 'Redis',
    'Git', 'GitHub', 'Docker', 'AWS', 'Azure', 'GCP', 'Linux',
    'REST API', 'GraphQL', 'Machine Learning', 'Data Analysis', 'Agile', 'Scrum',
  ];

  const foundSkills = commonSkills.filter((skill) => {
    const escaped = skill.replace(/[\.\+\#]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });

  return {
    name: candidateName,
    email: email !== 'candidate@email.com' ? email : null,
    phone: phone !== 'Contact Number' ? phone : null,
    linkedin: linkedinMatch ? linkedinMatch[0] : null,
    github: githubMatch ? githubMatch[0] : null,
    skills: foundSkills,
    summary: text.slice(0, 400).trim(),
  };
}
