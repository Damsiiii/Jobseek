export interface JobListing {
  title: string;
  company: string;
  location: string;
  source: string;
  job_url: string;
  description: string;
  /** ISO date (YYYY-MM-DD) of when the job was posted, if the source exposes it */
  posted_date?: string | null;
}
