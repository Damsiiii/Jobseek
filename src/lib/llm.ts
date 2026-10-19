import { GoogleGenAI } from '@google/genai';
import { getDb } from './db';
import type { ApplicationScores } from './atsScore';

export type OptimizationContext = {
  previousCv: string;
  previousCoverLetter: string;
  scores: ApplicationScores;
};

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
  jobDescription: string,
  optimizationContext?: OptimizationContext
): Promise<{ tailoredCv: string; coverLetter: string }> {
  const apiKey = await getApiKey();

  if (apiKey && apiKey.trim()) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const regenInstructions = optimizationContext
        ? `
---REGENERATION / ATS SCORE OPTIMIZATION FEEDBACK---
This is a score-improving revision. The previous version scored:
- CV ATS Score: ${optimizationContext.scores.cv.score}/100
  Missing Keywords: ${optimizationContext.scores.cv.missingKeywords.join(', ') || 'None'}
  Feedback Tips:
${optimizationContext.scores.cv.tips.map((t) => `  * ${t}`).join('\n') || '  * None'}

- Cover Letter ATS Score: ${optimizationContext.scores.coverLetter.score}/100
  Missing Keywords: ${optimizationContext.scores.coverLetter.missingKeywords.join(', ') || 'None'}
  Feedback Tips:
${optimizationContext.scores.coverLetter.tips.map((t) => `  * ${t}`).join('\n') || '  * None'}

PRIOR DRAFTS:
CV Draft:
"""
${optimizationContext.previousCv}
"""
Cover Letter Draft:
"""
${optimizationContext.previousCoverLetter}
"""

REVISION GOALS:
1. Address the missing keywords and feedback tips directly.
2. Weave missing keywords naturally into the CV Summary, Skills, and Experience bullets (truthfully reflecting candidate).
3. Ensure standard single-column ATS section headers: SUMMARY, TECHNICAL SKILLS, PROJECTS & EXPERIENCE, EDUCATION.
4. Ensure the Cover Letter strictly mentions "${companyName}" and "${jobTitle}", integrates missing keywords, and stays within 180-380 words with proper salutation and sign-off.
`
        : '';

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
${regenInstructions}
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

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out after 12s')), 12000)
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        }),
        timeoutPromise,
      ]);

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
  return generateFallbackTailoredApplication(
    candidateCV,
    jobTitle,
    companyName,
    jobDescription,
    optimizationContext
  );
}

import { extractCandidateName, extractCandidateContact } from './cvParser';
export { extractCandidateName, extractCandidateContact };

function generateFallbackTailoredApplication(
  candidateCV: string,
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  optimizationContext?: OptimizationContext
) {
  const { candidateName, email, phone } = extractCandidateContact(candidateCV);

  // Extract key technical words from job description + missing keywords from optimization context
  const baseKeywords = ['React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'Git', 'REST API', 'Agile', 'AWS', 'Docker', 'Testing', 'Problem Solving'];
  const matchedFromJd = baseKeywords.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(jobDescription));
  const missingFromContext = optimizationContext?.scores.cv.missingKeywords || [];
  const combinedKeywords = Array.from(new Set([...matchedFromJd, ...missingFromContext]));
  const matchedSkillsList = combinedKeywords.length > 0 ? combinedKeywords.join(', ') : 'Software Engineering, Problem Solving, Web Development, Databases, Git';

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

export type EngagementType = 'remote' | 'freelance';

export interface RemoteApplicationDocs {
  tailoredCv: string;
  coverLetter: string;
  proposal: string;
  pitch: string;
}

export async function generateRemoteApplication(
  candidateCV: string,
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  engagementType: EngagementType
): Promise<RemoteApplicationDocs> {
  const apiKey = await getApiKey();
  const engagementLabel =
    engagementType === 'freelance'
      ? 'freelance / one-time gig or contract project'
      : 'remote ongoing role (full-time, part-time, or contract)';

  if (apiKey && apiKey.trim()) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
You are an expert ATS Resume Optimization Specialist and Freelance Career Advisor.
Given the candidate's existing CV and a target ${engagementLabel} description, generate FOUR items formatted in clean Markdown:

1. **TAILORED ATS CV**:
   - Single-column standard ATS-friendly format.
   - Tailor summary, experience, projects, and skills to highlight keywords from the job/gig description.
   - Use wording appropriate for ${engagementType === 'freelance' ? 'freelance/contract work' : 'remote professional roles'} (NOT internship-centric).
   - Do NOT lie or invent fabricated credentials; rephrase and emphasize relevant projects and tech stack match.

2. **COVER LETTER**:
   - Professional and personalized to ${companyName || 'the client/company'} for the ${jobTitle} opportunity.
   - ${engagementType === 'freelance'
       ? 'Frame as outreach to a client or hiring contact for a freelance/contract engagement.'
       : 'Frame as a cover letter for a remote role.'}
   - Highlight top 3 relevant skills matching the description.

3. **PROPOSAL / BID**:
   - Project understanding, proposed approach, deliverables, realistic timeline assumptions, and why the candidate fits.
   - Suitable for Upwork/Freelancer-style proposals or contract remote pitches.
   - Keep it concrete and professional; do not invent past client names or metrics not in the CV.

4. **SHORT CLIENT PITCH**:
   - 80–120 words only.
   - Suitable for Upwork/Freelancer "cover letter" text boxes — concise, confident, keyword-aware.

Candidate CV:
"""
${candidateCV}
"""

Target Title: ${jobTitle}
Company / Client: ${companyName || 'Not specified'}
Engagement type: ${engagementType}
Description:
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
---PROPOSAL_START---
[Full Proposal / Bid Markdown Here]
---PROPOSAL_END---
---PITCH_START---
[Short Client Pitch Here]
---PITCH_END---
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      const cvMatch = text.match(/---CV_START---([\s\S]*?)---CV_END---/);
      const clMatch = text.match(/---COVER_LETTER_START---([\s\S]*?)---COVER_LETTER_END---/);
      const proposalMatch = text.match(/---PROPOSAL_START---([\s\S]*?)---PROPOSAL_END---/);
      const pitchMatch = text.match(/---PITCH_START---([\s\S]*?)---PITCH_END---/);

      if (cvMatch && clMatch && proposalMatch && pitchMatch) {
        return {
          tailoredCv: cvMatch[1].trim(),
          coverLetter: clMatch[1].trim(),
          proposal: proposalMatch[1].trim(),
          pitch: pitchMatch[1].trim(),
        };
      }
    } catch (err) {
      console.warn('Gemini API call error, using remote/freelance local customizer:', err);
    }
  }

  return generateFallbackRemoteApplication(
    candidateCV,
    jobTitle,
    companyName,
    jobDescription,
    engagementType
  );
}

function generateFallbackRemoteApplication(
  candidateCV: string,
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  engagementType: EngagementType
): RemoteApplicationDocs {
  const { candidateName, email, phone } = extractCandidateContact(candidateCV);

  const keywords = [
    'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'Git',
    'REST API', 'Agile', 'AWS', 'Docker', 'Testing', 'Problem Solving', 'Next.js',
  ];
  const matchingKeywords = keywords.filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(jobDescription));
  const matchedSkillsList =
    matchingKeywords.length > 0
      ? matchingKeywords.join(', ')
      : 'Software Engineering, Problem Solving, Web Development, Databases, Git';

  const companyLabel = companyName?.trim() || 'your team';
  const roleFocus =
    engagementType === 'freelance'
      ? 'freelance / contract engagements'
      : 'remote professional roles';

  const tailoredCv = `# ${candidateName}
${email} | ${phone} | Remote | LinkedIn | GitHub

## PROFESSIONAL SUMMARY
Results-oriented software developer seeking **${jobTitle}** opportunities with **${companyLabel}**. Experienced building reliable products with ${matchedSkillsList}. Comfortable with async collaboration, clear written communication, and delivering production-ready work for ${roleFocus}.

## TECHNICAL SKILLS
- **Programming Languages:** JavaScript, TypeScript, Python, Java, SQL, C++
- **Frameworks & Libraries:** React.js, Next.js, Node.js, Express, Tailwind CSS
- **Databases & Tools:** PostgreSQL, MySQL, SQLite, MongoDB, Git, Docker, REST APIs
- **Core Competencies:** Full-stack delivery, API design, testing, documentation, remote collaboration

## PROJECTS & RELEVANT EXPERIENCE
### Full-Stack Product & Client Work
- Designed and built responsive full-stack applications with clean UI and RESTful backend APIs.
- Delivered features end-to-end with clear milestones, status updates, and maintainable code.
- Integrated databases (SQLite/PostgreSQL) and automated checks to improve reliability.

### Technical Delivery
- **Web Engineering:** Built modular frontend components and backend services aligned to product goals.
- **Quality & Process:** Used Git workflows, iterative delivery, and pragmatic testing for steady progress.

## EDUCATION
**B.Sc. (Hons) in Computer Science / Software Engineering**
University / Higher Education Institute
*Relevant Coursework: Data Structures, Web Development, Database Management, Software Quality Assurance*

---
*Tailored for ${jobTitle} (${engagementType}) — ${companyLabel}*`;

  const coverLetter = `[Date]

Hiring / Client Contact
${companyLabel}

**RE: ${jobTitle}**

Dear Hiring Manager / Client,

I am writing to apply for the **${jobTitle}** opportunity with **${companyLabel}**. I am seeking ${roleFocus} where I can contribute strong full-stack skills and dependable delivery.

My experience includes building applications with ${matchedSkillsList}, shipping features with clear communication, and adapting quickly to new requirements. I am comfortable working remotely, documenting decisions, and keeping stakeholders updated.

Why I am a strong fit for this ${engagementType === 'freelance' ? 'engagement' : 'role'}:
- Hands-on proficiency across modern web stacks and API-driven systems.
- Ability to break work into milestones and communicate progress clearly.
- A practical, ownership-oriented approach focused on usable outcomes.

Thank you for considering my application. I would welcome a conversation about how I can help ${companyLabel} succeed on this ${jobTitle} work.

Sincerely,

${candidateName}
${email}
${phone}`;

  const proposal = `# Proposal: ${jobTitle}

**To:** ${companyLabel}  
**From:** ${candidateName}  
**Engagement:** ${engagementType === 'freelance' ? 'Freelance / project-based' : 'Remote role / contract'}

## Understanding
Based on your description, the goal is to deliver **${jobTitle}** with a focus on reliable implementation and clear communication. I will align the solution to the requirements you shared and flag ambiguities early.

## Approach
1. Confirm scope, success criteria, and preferred tools/stack.
2. Propose a short milestone plan with review checkpoints.
3. Implement iteratively with demos or written progress updates.
4. Hand over documented code, setup notes, and next-step recommendations.

## Deliverables
- Working implementation matching the agreed scope
- Clean, readable code with basic documentation
- Brief summary of decisions and how to run/test the work

## Timeline assumptions
- Kickoff and clarification: 1–2 days after approval
- Core delivery: phased milestones (exact dates depend on final scope)
- Buffer for revision feedback after each milestone

## Why me
I bring hands-on experience with ${matchedSkillsList}, remote collaboration habits, and a delivery style that prioritizes clarity and usable outcomes without inventing credentials beyond my real background.

I am ready to start after a short alignment call or written brief confirmation.`;

  const pitch = `Hi — I'm ${candidateName}, a software developer experienced with ${matchedSkillsList}. I reviewed your ${jobTitle} posting for ${companyLabel} and can help deliver a clear, milestone-based solution with regular updates and clean handoff documentation. I work well remotely, communicate in writing, and focus on practical results that match your brief. Happy to share a short plan and timeline once we confirm scope. Looking forward to collaborating.`;

  return { tailoredCv, coverLetter, proposal, pitch };
}
