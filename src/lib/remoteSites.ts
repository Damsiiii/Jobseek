export type RemoteSiteCategory = 'remote' | 'freelance';

export interface RemoteSite {
  id: string;
  name: string;
  category: RemoteSiteCategory;
  description: string;
  homeUrl: string;
  buildSearchUrl: (keywords: string[]) => string;
  notes?: string;
}

function joinKeywords(keywords: string[], separator = ' '): string {
  return keywords.map((k) => k.trim()).filter(Boolean).join(separator);
}

function encodeQuery(keywords: string[]): string {
  return encodeURIComponent(joinKeywords(keywords));
}

function slugifyKeyword(keyword: string): string {
  return keyword
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const REMOTE_SITES: RemoteSite[] = [
  // Remote / ongoing roles
  {
    id: 'remoteok',
    name: 'Remote OK',
    category: 'remote',
    description: 'Popular remote job board with tech, design, and marketing roles worldwide.',
    homeUrl: 'https://remoteok.com',
    buildSearchUrl: (keywords) => {
      const primary = slugifyKeyword(keywords[0] || 'dev') || 'dev';
      return `https://remoteok.com/remote-${primary}-jobs`;
    },
  },
  {
    id: 'remotive',
    name: 'Remotive',
    category: 'remote',
    description: 'Curated remote jobs across software, product, and customer support.',
    homeUrl: 'https://remotive.com/remote-jobs',
    buildSearchUrl: (keywords) =>
      `https://remotive.com/remote-jobs/search?search=${encodeQuery(keywords)}`,
  },
  {
    id: 'weworkremotely',
    name: 'We Work Remotely',
    category: 'remote',
    description: 'Long-running remote board for programming, design, and marketing roles.',
    homeUrl: 'https://weworkremotely.com',
    buildSearchUrl: (keywords) =>
      `https://weworkremotely.com/remote-jobs/search?term=${encodeQuery(keywords)}`,
  },
  {
    id: 'himalayas',
    name: 'Himalayas',
    category: 'remote',
    description: 'Remote-first company directory and job board with strong tech coverage.',
    homeUrl: 'https://himalayas.app/jobs',
    buildSearchUrl: (keywords) =>
      `https://himalayas.app/jobs/search?q=${encodeQuery(keywords)}`,
  },
  {
    id: 'flexjobs',
    name: 'FlexJobs',
    category: 'remote',
    description: 'Vetted flexible and remote roles across many industries.',
    homeUrl: 'https://www.flexjobs.com',
    buildSearchUrl: (keywords) =>
      `https://www.flexjobs.com/search?search=${encodeQuery(keywords)}`,
    notes: 'Some listings require a FlexJobs account.',
  },
  {
    id: 'linkedin-remote',
    name: 'LinkedIn Remote',
    category: 'remote',
    description: 'LinkedIn job search filtered to remote work arrangements.',
    homeUrl: 'https://www.linkedin.com/jobs/',
    buildSearchUrl: (keywords) => {
      const q = encodeQuery(keywords);
      return `https://www.linkedin.com/jobs/search/?keywords=${q}&f_WT=2`;
    },
  },
  // Freelance / one-time gigs
  {
    id: 'upwork',
    name: 'Upwork',
    category: 'freelance',
    description: 'Large freelance marketplace for hourly and fixed-price project gigs.',
    homeUrl: 'https://www.upwork.com',
    buildSearchUrl: (keywords) =>
      `https://www.upwork.com/nx/search/jobs/?q=${encodeQuery(keywords)}`,
    notes: 'Login required to apply.',
  },
  {
    id: 'freelancer',
    name: 'Freelancer',
    category: 'freelance',
    description: 'Bid on one-time projects across software, design, and writing.',
    homeUrl: 'https://www.freelancer.com',
    buildSearchUrl: (keywords) =>
      `https://www.freelancer.com/jobs/?keyword=${encodeQuery(keywords)}`,
    notes: 'Login required to bid.',
  },
  {
    id: 'fiverr',
    name: 'Fiverr',
    category: 'freelance',
    description: 'Gig marketplace — search buyer requests or related services.',
    homeUrl: 'https://www.fiverr.com',
    buildSearchUrl: (keywords) =>
      `https://www.fiverr.com/search/gigs?query=${encodeQuery(keywords)}`,
    notes: 'Seller job requests may require a Fiverr seller account.',
  },
  {
    id: 'guru',
    name: 'Guru',
    category: 'freelance',
    description: 'Freelance projects with skill-based job browsing.',
    homeUrl: 'https://www.guru.com',
    buildSearchUrl: (keywords) =>
      `https://www.guru.com/d/jobs/skill/${encodeURIComponent(slugifyKeyword(keywords[0] || 'software') || 'software')}/`,
  },
  {
    id: 'peopleperhour',
    name: 'PeoplePerHour',
    category: 'freelance',
    description: 'Hourly and project-based freelance jobs, popular for short engagements.',
    homeUrl: 'https://www.peopleperhour.com',
    buildSearchUrl: (keywords) =>
      `https://www.peopleperhour.com/freelance-jobs?q=${encodeQuery(keywords)}`,
  },
  {
    id: 'contra',
    name: 'Contra',
    category: 'freelance',
    description: 'Independent work opportunities with a focus on creatives and builders.',
    homeUrl: 'https://contra.com',
    buildSearchUrl: (keywords) =>
      `https://contra.com/opportunity/find?query=${encodeQuery(keywords)}`,
  },
];

export function getSitesByCategory(category: RemoteSiteCategory | 'all'): RemoteSite[] {
  if (category === 'all') return REMOTE_SITES;
  return REMOTE_SITES.filter((site) => site.category === category);
}
