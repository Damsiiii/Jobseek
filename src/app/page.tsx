'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  FileText,
  Upload,
  Settings,
  RefreshCw,
  Search,
  Download,
  Printer,
  Sparkles,
  CheckCircle,
  ExternalLink,
  MapPin,
  Building,
  Key,
  X,
  FileCheck,
  Clock,
  Wand2
} from 'lucide-react';
import { downloadAsDocx, printOrSavePdf } from '@/lib/exportUtils';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  source: string;
  job_url: string;
  description: string;
  posted_date: string | null;
  scraped_at: string;
}

interface Profile {
  id: number;
  filename: string;
  raw_text: string;
  parsed_json: {
    email?: string;
    phone?: string;
    skills?: string[];
    summary?: string;
  } | null;
  updated_at: string;
}

/** Formats an ISO posted date as a human-friendly relative time, e.g. "3 days ago". */
const formatPostedDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString();
};

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('All');

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [generatingForJobId, setGeneratingForJobId] = useState<number | null>(null);
  const [lastKeywords, setLastKeywords] = useState<string[]>([]);

  // Active customized document modal/drawer
  const [activeApplication, setActiveApplication] = useState<{
    job: Job;
    tailoredCv: string;
    coverLetter: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'cv' | 'coverLetter'>('cv');

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchJobs();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings.gemini_api_key) {
        setGeminiKey(data.settings.gemini_api_key);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'gemini_api_key', value: geminiKey }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsSavedMsg('API Key saved successfully!');
        setTimeout(() => setSettingsSavedMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobs = async (triggerScrape = false, basedOnCv = false) => {
    setLoadingJobs(true);
    try {
      let url = '/api/jobs';
      if (triggerScrape) {
        url = basedOnCv ? '/api/jobs?scrape=true&basedOn=cv' : '/api/jobs?scrape=true';
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
        if (Array.isArray(data.keywords)) {
          setLastKeywords(data.keywords);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCv(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        // Automatically scrape internships matched to the uploaded CV
        await fetchJobs(true, true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingCv(false);
    }
  };

  const handleTailorApplication = async (job: Job) => {
    if (!profile) {
      alert('Please upload your CV PDF first so we can customize it for this job!');
      return;
    }

    setGeneratingForJobId(job.id);
    try {
      const res = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveApplication({
          job,
          tailoredCv: data.tailoredCv,
          coverLetter: data.coverLetter,
        });
        setActiveTab('cv');
      } else {
        alert(data.error || 'Failed to generate tailored application.');
      }
    } catch (err) {
      console.error(err);
      alert('Error generating application.');
    } finally {
      setGeneratingForJobId(null);
    }
  };

  // Filter jobs by search and source
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = selectedSource === 'All' || job.source === selectedSource;
    return matchesSearch && matchesSource;
  });

  const parseFormattedText = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderMarkdownText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-2xl font-bold text-gray-900 border-b-2 border-gray-900 pb-1 mb-3 text-center uppercase tracking-wide">
            {trimmed.replace('# ', '')}
          </h1>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-lg font-bold text-gray-800 border-b border-gray-300 mt-4 mb-2 uppercase tracking-wider">
            {trimmed.replace('## ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-md font-semibold text-gray-800 mt-3 mb-1">
            {trimmed.replace('### ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.replace(/^[-*]\s+/, '');
        return (
          <li key={idx} className="ml-5 list-disc text-sm text-gray-700 leading-relaxed mb-1">
            {parseFormattedText(content)}
          </li>
        );
      }
      if (!trimmed) {
        return <div key={idx} className="h-2"></div>;
      }
      return (
        <p key={idx} className="text-sm text-gray-700 leading-relaxed mb-2">
          {parseFormattedText(line)}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {/* Navigation Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LankaIntern AI</h1>
              <p className="text-xs text-slate-400">Sri Lanka Internship Scraper & ATS CV Builder</p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-sm transition-colors border border-slate-700"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>LLM Settings</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar: Profile & CV Upload */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Your Base CV Profile</span>
            </h2>

            {profile ? (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <FileCheck className="w-8 h-8 text-indigo-600 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-900 truncate">{profile.filename}</p>
                      <p className="text-xs text-slate-500">
                        Uploaded {new Date(profile.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {profile.parsed_json?.skills && profile.parsed_json.skills.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Detected Technical Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.parsed_json.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => fetchJobs(true, true)}
                  disabled={loadingJobs}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Wand2 className={`w-4 h-4 ${loadingJobs ? 'animate-pulse' : ''}`} />
                  <span>{loadingJobs ? 'Scraping Matches...' : 'Scrape Jobs Matched to My CV'}</span>
                </button>

                <label className="block w-full text-center py-2 px-4 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-medium transition-colors">
                  {uploadingCv ? 'Processing CV & Scraping...' : 'Update CV (PDF)'}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingCv}
                  />
                </label>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50">
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-800">Upload your CV in PDF</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Upload your CV to automatically find applicable internships in Sri Lanka
                </p>
                <label className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg cursor-pointer transition-colors shadow-sm">
                  {uploadingCv ? 'Uploading...' : 'Choose PDF File'}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingCv}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Sources Badge */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">
              Scraped Sri Lankan Job Portals
            </h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>Rooster.lk</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Active</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>XpressJobs</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Active</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>Finder.lk</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Active</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>FindMyJob.lk</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Active</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>Tracker Jobs (TopJobs)</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Active</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>LinkedIn</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Area: Scraped Internship Job Listings */}
        <div className="lg:col-span-8 space-y-6">
          {/* Controls & Search */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search internships by title, tech stack or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Sources</option>
                <option value="Rooster.lk">Rooster.lk</option>
                <option value="XpressJobs">XpressJobs</option>
                <option value="Finder.lk">Finder.lk</option>
                <option value="FindMyJob.lk">FindMyJob.lk</option>
                <option value="Tracker Jobs">Tracker Jobs</option>
                <option value="LinkedIn">LinkedIn</option>
              </select>

              <button
                onClick={() => fetchJobs(true)}
                disabled={loadingJobs}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2 px-4 rounded-lg transition-colors shadow-sm flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loadingJobs ? 'animate-spin' : ''}`} />
                <span>{loadingJobs ? 'Scraping...' : 'Scrape Jobs'}</span>
              </button>
            </div>
          </div>

          {lastKeywords.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 px-1">
              <span className="font-semibold uppercase tracking-wider">Searching:</span>
              {lastKeywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium border border-indigo-100">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Jobs List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-slate-900">
                Available Internship Positions ({filteredJobs.length})
              </h2>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800">No internships found</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">
                  Click "Scrape Jobs" to fetch the latest internship postings across Sri Lanka.
                </p>
                <button
                  onClick={() => fetchJobs(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Run Scraper Now</span>
                </button>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-md">
                          {job.source}
                        </span>
                        {formatPostedDate(job.posted_date) && (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 text-xs font-semibold rounded-md border border-amber-100">
                            <Clock className="w-3 h-3" />
                            Posted {formatPostedDate(job.posted_date)}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          Scraped {new Date(job.scraped_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">{job.title}</h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {job.location}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View original job link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => handleTailorApplication(job)}
                        disabled={generatingForJobId === job.id}
                        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors shadow-sm"
                      >
                        <Sparkles className={`w-4 h-4 ${generatingForJobId === job.id ? 'animate-spin' : ''}`} />
                        <span>
                          {generatingForJobId === job.id
                            ? 'Tailoring...'
                            : 'Customize ATS CV & Cover Letter'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 mt-4 line-clamp-3 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {job.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Tailored Document Modal / Drawer */}
      {activeApplication && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-6 h-6 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-lg">Tailored Application</h3>
                  <p className="text-xs text-slate-400">
                    {activeApplication.job.title} at {activeApplication.job.company}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveApplication(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Tabs & Action Bar */}
            <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                <button
                  onClick={() => setActiveTab('cv')}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                    activeTab === 'cv'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ATS Friendly CV
                </button>
                <button
                  onClick={() => setActiveTab('coverLetter')}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                    activeTab === 'coverLetter'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cover Letter
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    downloadAsDocx(
                      `${activeApplication.job.company}_${
                        activeTab === 'cv' ? 'ATS_CV' : 'Cover_Letter'
                      }`,
                      activeTab === 'cv'
                        ? activeApplication.tailoredCv
                        : activeApplication.coverLetter
                    )
                  }
                  className="flex items-center space-x-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Download DOCX</span>
                </button>

                <button
                  onClick={() =>
                    printOrSavePdf(
                      'preview-document-content',
                      `${activeApplication.job.company} - ${
                        activeTab === 'cv' ? 'ATS CV' : 'Cover Letter'
                      }`
                    )
                  }
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Download PDF</span>
                </button>
              </div>
            </div>

            {/* Preview Document Paper Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-200 flex justify-center">
              <div
                id="preview-document-content"
                className="bg-white p-8 sm:p-12 shadow-lg border border-slate-300 max-w-2xl w-full min-h-[650px] font-sans text-slate-900"
              >
                {renderMarkdownText(
                  activeTab === 'cv'
                    ? activeApplication.tailoredCv
                    : activeApplication.coverLetter
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LLM Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-lg text-slate-900">LLM API Configuration</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Configure your free Google Gemini API key to customize resumes and generate cover letters dynamically. If left blank, our intelligent built-in ATS engine will format your application automatically.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Gemini API Key (Free)
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {settingsSavedMsg && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{settingsSavedMsg}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={saveSettings}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
