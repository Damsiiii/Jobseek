# LankaIntern AI 🇱🇰

An intelligent Sri Lankan internship aggregator, remote & freelance directory, and ATS-tailored document builder built with Next.js, Cheerio, SQLite, and Google Gemini AI.

---

## 🌟 Key Features

- **Multi-Portal Internship Aggregator** (`/`):
  Automatically scrapes, normalizes, and deduplicates internship postings from Sri Lanka's top job portals:
  - **LinkedIn** (Public guest search with experience & 7-day recency filters)
  - **Rooster.lk**
  - **XpressJobs.lk**
  - **Finder.lk**
  - **FindMyJob.lk**
  - **Tracker Jobs** (TopJobs aggregator)

- **Remote & Freelance Directory** (`/remote`):
  Curated deep-links (no scraping) to remote job boards and freelancing marketplaces, with CV-based search URL builders:
  - **Remote**: Remote OK, Remotive, We Work Remotely, Himalayas, FlexJobs, LinkedIn Remote
  - **Freelance**: Upwork, Freelancer, Fiverr, Guru, PeoplePerHour, Contra
  - Filter **All / Remote / Freelance**, open home pages, or **Search with my skills** / **Open matched searches**

- **CV-Driven Search & Skill Extraction**:
  - Upload your CV in **PDF** format.
  - Automatically parses text and extracts contact details, LinkedIn/GitHub profiles, and technical skills using `pdf2json` and dictionary-based regex matching.
  - Derives role-defining search keywords (prioritizing frameworks/languages like React, Python, Java over generic terms like Git/HTML).
  - One-click **"Scrape Jobs Matched to My CV"** on Internships, or skill-matched site searches on Remote & Freelance.

- **AI-Powered Document Generation**:
  - **Internships**: ATS CV + cover letter tailored to a scraped job (`/api/tailor`).
  - **Remote & Freelance**: ATS CV, cover letter, proposal/bid, and short client pitch from a pasted listing (`/api/tailor-remote`).
  - Uses **Google Gemini 2.5 Flash** (`@google/genai`) with an intelligent local fallback when no API key is set.

- **Exporting & Printing**:
  - **DOCX**: Download generated documents as Microsoft Word files.
  - **Print / PDF**: Clean, print-styled layout via your browser's print engine.
  - On `/remote`, download the active tab or **all four** documents as separate `.docx` files.

- **Local Persistence & Settings**:
  - Stores scraped jobs, candidate profiles, applications, and configurations locally in SQLite (`data.sqlite`).
  - Configure your free Gemini API key via **LLM Settings** in the shared header or environment variables.

---

## 🏗️ Project Architecture & Directory Structure

```text
Jobseek/
├── data.sqlite                  # Local SQLite database (jobs, profile, settings, applications)
├── public/                      # Static assets
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── jobs/
│   │   │   │   └── route.ts     # Scrapes & returns stored job listings
│   │   │   ├── profile/
│   │   │   │   └── route.ts     # Uploads & parses candidate PDF CV
│   │   │   ├── settings/
│   │   │   │   └── route.ts     # Saves & reads Gemini API key
│   │   │   ├── tailor/
│   │   │   │   └── route.ts     # Internship ATS CV & cover letter
│   │   │   └── tailor-remote/
│   │   │       └── route.ts     # Remote/freelance four-document generator
│   │   ├── remote/
│   │   │   └── page.tsx         # Remote & freelance directory + doc generator
│   │   ├── globals.css          # Tailwind CSS v4 styling
│   │   ├── layout.tsx           # Root layout, shared nav header
│   │   └── page.tsx             # Internship dashboard
│   ├── components/
│   │   └── AppHeader.tsx        # Shared nav + LLM settings
│   └── lib/
│       ├── db.ts                # SQLite connection & schema initialization
│       ├── exportUtils.ts       # Word (.docx) export & print-to-PDF utilities
│       ├── llm.ts               # Gemini + rule-based document generators
│       ├── remoteSites.ts       # Curated remote/freelance site catalog
│       └── scrapers/
│           ├── cvKeywords.ts    # Extracts priority search terms from CV skills
│           ├── dateUtils.ts     # Parses relative posted dates from HTML
│           ├── finder.ts        # Scraper for Finder.lk
│           ├── findmyjob.ts     # Scraper for FindMyJob.lk
│           ├── index.ts         # Scraper orchestrator & deduplication pipeline
│           ├── linkedin.ts      # Scraper for LinkedIn guest search
│           ├── rooster.ts       # Scraper for Rooster.lk
│           ├── tracker.ts       # Scraper for Tracker Jobs (TopJobs)
│           ├── types.ts         # TypeScript definitions for job listings
│           └── xpressjobs.ts    # Scraper for XpressJobs.lk
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Frontend**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Scraping & Parsing**: [Cheerio](https://cheerio.js.org/), [Axios](https://axios-http.com/), [pdf2json](https://github.com/modesty/pdf2json)
- **Database**: [SQLite3](https://www.sqlite.org/) via [`sqlite`](https://www.npmjs.com/package/sqlite)
- **AI / LLM**: [Google Gen AI SDK](https://github.com/google/generative-ai-js) (`gemini-2.5-flash`)
- **Document Generation**: [`docx`](https://docx.js.org/)

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v18.17.0` or higher
- **npm**, **yarn**, or **pnpm**

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd Jobseek
npm install
```

### 3. Configure Gemini API Key (Optional)
You can configure a free Google Gemini API key in either of two ways:

1. **Via `.env.local`**:
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
2. **Via UI**:
   Click **"LLM Settings"** in the top navigation bar and save your key.

*(Note: If no API key is set, the application will automatically fall back to its internal deterministic ATS customizer.)*

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for Internships, or [http://localhost:3000/remote](http://localhost:3000/remote) for Remote & Freelance.

---

## 📖 How to Use

### Internships (`/`)
1. Upload your base CV (PDF) in the left sidebar.
2. Click **"Scrape Jobs Matched to My CV"** or enter keywords and scrape.
3. Filter by title/company/source and open original postings.
4. Click **"Customize ATS CV & Cover Letter"** on a job card, then export DOCX/PDF.

### Remote & Freelance (`/remote`)
1. Upload or reuse the same CV profile.
2. Filter the directory (All / Remote / Freelance) and open sites or **Search with my skills**.
3. Optionally click **Open matched searches** to open several CV-matched search tabs.
4. Paste a remote job or freelance gig description, choose **Remote role** or **One-time / freelance**, and generate documents.
5. Preview tabs: **ATS CV**, **Cover letter**, **Proposal / bid**, **Short pitch** — download one or all as DOCX, or print/PDF.

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/jobs` | `GET` | Fetches saved jobs. Pass `?scrape=true` to trigger scraping, `?keyword=...` for query, or `?basedOn=cv` to query based on profile skills. |
| `/api/jobs` | `POST` | Triggers a scrape with body `{ keyword?: string, basedOn?: 'cv' }`. |
| `/api/profile` | `GET` | Returns the latest parsed CV profile. |
| `/api/profile` | `POST` | Uploads a CV (supports `multipart/form-data` with PDF or JSON with raw text). |
| `/api/tailor` | `POST` | Generates a tailored ATS CV & Cover Letter for a specific `jobId`. |
| `/api/tailor-remote` | `POST` | Generates ATS CV, cover letter, proposal, and pitch from `{ title, company?, description, engagementType: 'remote' \| 'freelance' }`. |
| `/api/tailor-remote` | `GET` | Lists recent remote applications, or `?id=` for one row. |
| `/api/settings` | `GET` / `POST` | Reads or updates application settings (e.g., `gemini_api_key`). |

---

## 📄 License

This project is licensed under the MIT License.
