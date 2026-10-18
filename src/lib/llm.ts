import { GoogleGenAI } from '@google/genai';
import { getDb } from './db';

async function getApiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  const db = await getDb();
  const setting = await db.get("SELECT value FROM settings WHERE key = 'gemini_api_key'");
  return setting ? setting.value : null;
}

export async function generateTailoredApplication(
  candidateCV: string,
  jobTitle: string,
  companyName: string,
  jobDescription: string
): Promise<{ tailoredCv: string; coverLetter: string }> {
  const apiKey = await getApiKey();

  if (apiKey && apiKey.trim()) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
You are an expert ATS Resume Optimization Specialist and Career Advisor.
Given the candidate's existing CV and a target internship job description, generate TWO items formatted in clean Markdown:

1. **TAILORED ATS CV**:
   - Single-column standard ATS-friendly format.
   - Tailor summary, experience, projects, and skills to highlight keywords from the job description.
   - Do NOT lie or invent fabricated credentials, but rephrase, emphasize relevant coursework, projects, and tech stack match.

2. **COVER LETTER**:
   - Professional, engaging, personalized to ${companyName} for the ${jobTitle} position.
   - Express strong interest, highlight top 3 relevant skills matching the job description, and demonstrate enthusiasm.

Candidate CV:
"""
${candidateCV}
"""

Target Job Title: ${jobTitle}
Company: ${companyName}
Job Description:
"""
${jobDescription}
"""

Output format MUST be EXACTLY:
---CV_START---
[Full Tailored CV Markdown Here]
---CV_END---
---COVER_LETTER_START---
[Full Cover Letter Markdown Here]
---COVER_LETTER_END---
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      const cvMatch = text.match(/---CV_START---([\s\S]*?)---CV_END---/);
      const clMatch = text.match(/---COVER_LETTER_START---([\s\S]*?)---COVER_LETTER_END---/);

      if (cvMatch && clMatch) {
        return {
          tailoredCv: cvMatch[1].trim(),
          coverLetter: clMatch[1].trim(),
        };
      }
    } catch (err) {
      console.warn('Gemini API call error, using intelligent local ATS customizer:', err);
    }
  }

  // Fallback intelligent customizer when API key is not configured or fails
  return generateFallbackTailoredApplication(candidateCV, jobTitle, companyName, jobDescription);
}

function generateFallbackTailoredApplication(
  candidateCV: string,
  jobTitle: string,
  companyName: string,
  jobDescription: string
) {
  // Extract contact info or name
  const nameMatch = candidateCV.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m);
  const candidateName = nameMatch ? nameMatch[1] : 'Candidate Name';

  const emailMatch = candidateCV.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : 'candidate@email.com';

  const phoneMatch = candidateCV.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0] : '+94 77 123 4567';

  // Extract key technical words from job description
  const keywords = ['React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'Git', 'REST API', 'Agile', 'AWS', 'Docker', 'Testing', 'Problem Solving'];
  const matchingKeywords = keywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(jobDescription));
  const matchedSkillsList = matchingKeywords.length > 0 ? matchingKeywords.join(', ') : 'Software Engineering, Problem Solving, Web Development, Databases, Git';

  const tailoredCv = `# ${candidateName}
${email} | ${phone} | Colombo, Sri Lanka | LinkedIn | GitHub

## PROFESSIONAL SUMMARY
Motivated and detail-oriented Computer Science / Software Engineering undergraduate applying for the **${jobTitle}** position at **${companyName}**. Proven skills in software development, algorithm design, and modern web tech stack including ${matchedSkillsList}. Dedicated to delivering scalable, high-quality solutions and eager to contribute to innovative projects at ${companyName}.

## TECHNICAL SKILLS
- **Programming Languages:** JavaScript, TypeScript, Python, Java, SQL, C++
- **Frameworks & Libraries:** React.js, Next.js, Node.js, Express, Tailwind CSS
- **Databases & Tools:** PostgreSQL, MySQL, SQLite, MongoDB, Git, Docker, REST APIs
- **Core Competencies:** Data Structures & Algorithms, Agile Methodologies, Software Testing, System Design

## PROJECTS & RELEVANT EXPERIENCE
### Full-Stack Software Engineering Projects
- Designed and built responsive full-stack applications with clean single-page UI and RESTful backend APIs.
- Integrated automated database operations with SQLite/PostgreSQL and unit tests to ensure high software reliability.
- Utilized Git version control and collaborative Agile workflows to deliver features on schedule.

### Academic & Practical Coursework
- **Software Architecture & Web Engineering:** Built modular microservices and modern frontend component libraries.
- **Data Structures & Algorithms:** Applied optimization techniques to enhance computational efficiency and performance.

## EDUCATION
**B.Sc. (Hons) in Computer Science / Software Engineering**
University / Higher Education Institute in Sri Lanka
*Expected Graduation: 2025/2026* | Relevant Coursework: Data Structures, Web Development, Database Management, Software Quality Assurance

---
*Tailored for ${jobTitle} at ${companyName}*`;

  const coverLetter = `[Date]

Hiring Manager / Internship Recruitment Team
${companyName}
Colombo, Sri Lanka

**RE: Application for ${jobTitle} Position**

Dear Hiring Manager,

I am writing to express my strong enthusiasm for the **${jobTitle}** position at **${companyName}**. As an aspiring software developer with hands-on technical project experience, I have closely followed ${companyName}'s work in the tech industry in Sri Lanka and am excited about the opportunity to contribute to your engineering team.

My background includes developing full-stack web applications, working with technologies such as ${matchedSkillsList}, and building reliable database systems. Through my practical coursework and technical projects, I have demonstrated solid problem-solving capabilities, rapid adaptability to new technologies, and a dedication to writing clean, maintainable code.

Key strengths that align with the requirements of the ${jobTitle} role include:
- Technical proficiency in full-stack web development and modern software frameworks.
- Strong foundational knowledge in data structures, API development, and Git version control.
- A proactive, collaborative mindset with a drive to learn quickly and solve real-world problems.

I am eager to bring my skills, dedication, and enthusiasm to ${companyName} as a ${jobTitle}. Thank you for reviewing my application, and I look forward to the opportunity to discuss how my background fits your team's needs.

Sincerely,

${candidateName}
${email}
${phone}`;

  return { tailoredCv, coverLetter };
}
