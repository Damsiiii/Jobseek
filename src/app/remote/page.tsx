'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Upload,
  Search,
  Download,
  Printer,
  Sparkles,
  ExternalLink,
  FileCheck,
  Globe,
  Briefcase,
  X,
  Wand2,
} from 'lucide-react';
import { downloadAsDocx, printOrSavePdf } from '@/lib/exportUtils';
import { REMOTE_SITES, type RemoteSiteCategory } from '@/lib/remoteSites';
import { deriveSearchKeywords } from '@/lib/scrapers/cvKeywords';

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

type EngagementType = 'remote' | 'freelance';
type DocTab = 'cv' | 'coverLetter' | 'proposal' | 'pitch';
type CategoryFilter = 'all' | RemoteSiteCategory;

interface GeneratedDocs {
  title: string;
  company: string | null;
  engagementType: EngagementType;
  tailoredCv: string;
  coverLetter: string;
  proposal: string;
  pitch: string;
}

export default function RemotePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [siteSearch, setSiteSearch] = useState('');

  const [engagementType, setEngagementType] = useState<EngagementType>('remote');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);

  const [activeDocs, setActiveDocs] = useState<GeneratedDocs | null>(null);
  const [activeTab, setActiveTab] = useState<DocTab>('cv');

  useEffect(() => {
    fetchProfile();
  }, []);

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

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/profile', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        await fetchProfile();
      } else {
        alert(data.error || 'Failed to upload CV.');
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading CV.');
    } finally {
      setUploadingCv(false);
      e.target.value = '';
    }
  };

  const cvKeywords = useMemo(() => {
    const skills = profile?.parsed_json?.skills || [];
    return deriveSearchKeywords(skills, 3, 'developer');
  }, [profile]);

  const filteredSites = useMemo(() => {
    return REMOTE_SITES.filter((site) => {
      const matchesCategory = categoryFilter === 'all' || site.category === categoryFilter;
      const q = siteSearch.toLowerCase();
      const matchesSearch =
        !q ||
        site.name.toLowerCase().includes(q) ||
        site.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, siteSearch]);

  const openMatchedSearches = () => {
    const sites = filteredSites.slice(0, 6);
    for (const site of sites) {
      window.open(site.buildSearchUrl(cvKeywords), '_blank', 'noopener,noreferrer');
    }
  };

  const generateDocuments = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Please enter a title and paste the job or gig description.');
      return;
    }
    if (!profile) {
      alert('Please upload your CV profile first.');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/tailor-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          company: company.trim() || undefined,
          description: description.trim(),
          engagementType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveDocs({
          title: data.title,
          company: data.company,
          engagementType: data.engagementType,
          tailoredCv: data.tailoredCv,
          coverLetter: data.coverLetter,
          proposal: data.proposal,
          pitch: data.pitch,
        });
        setActiveTab('cv');
      } else {
        alert(data.error || 'Failed to generate documents.');
      }
    } catch (err) {
      console.error(err);
      alert('Error generating documents.');
    } finally {
      setGenerating(false);
    }
  };

  const activeContent = () => {
    if (!activeDocs) return '';
    switch (activeTab) {
      case 'cv':
        return activeDocs.tailoredCv;
      case 'coverLetter':
        return activeDocs.coverLetter;
      case 'proposal':
        return activeDocs.proposal;
      case 'pitch':
        return activeDocs.pitch;
    }
  };

  const tabFilename = () => {
    const base = (activeDocs?.title || 'application').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const map: Record<DocTab, string> = {
      cv: `${base}_CV.docx`,
      coverLetter: `${base}_Cover_Letter.docx`,
      proposal: `${base}_Proposal.docx`,
      pitch: `${base}_Pitch.docx`,
    };
    return map[activeTab];
  };

  const downloadAllDocx = async () => {
    if (!activeDocs) return;
    const base = (activeDocs.title || 'application').replace(/[^\w\-]+/g, '_').slice(0, 40);
    await downloadAsDocx(`${base}_CV.docx`, activeDocs.tailoredCv);
    await downloadAsDocx(`${base}_Cover_Letter.docx`, activeDocs.coverLetter);
    await downloadAsDocx(`${base}_Proposal.docx`, activeDocs.proposal);
    await downloadAsDocx(`${base}_Pitch.docx`, activeDocs.pitch);
  };

  const parseFormattedText = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const renderMarkdownText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return (
          <h1
            key={idx}
            className="text-2xl font-bold text-gray-900 border-b-2 border-gray-900 pb-1 mb-3 text-center uppercase tracking-wide"
          >
            {trimmed.replace('# ', '')}
          </h1>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2
            key={idx}
            className="text-lg font-bold text-gray-800 border-b border-gray-300 mt-4 mb-2 uppercase tracking-wider"
          >
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-7 h-7 text-indigo-600" />
              Remote & Freelance
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Browse curated remote job boards and freelancing marketplaces, open CV-matched
              searches, then paste a listing to generate an ATS CV, cover letter, proposal, and
              short client pitch.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            <Briefcase className="w-4 h-4" />
            Back to Internships
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: CV profile */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span>Your Base CV Profile</span>
              </h3>

              {profile ? (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center space-x-3 overflow-hidden">
                    <FileCheck className="w-8 h-8 text-indigo-600 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {profile.filename}
                      </p>
                      <p className="text-xs text-slate-500">
                        Uploaded {new Date(profile.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {profile.parsed_json?.skills && profile.parsed_json.skills.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Detected Skills
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

                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Search keywords from CV
                    </p>
                    <p className="text-sm text-slate-700">{cvKeywords.join(', ')}</p>
                  </div>

                  <label className="block w-full text-center py-2 px-4 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer text-sm font-medium transition-colors">
                    {uploadingCv ? 'Processing CV...' : 'Update CV (PDF)'}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleCvUpload}
                      disabled={uploadingCv}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Upload your CV to unlock skill-based search links and document generation.
                  </p>
                  <label className="flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm font-medium text-slate-600">
                      {uploadingCv ? 'Processing...' : 'Choose PDF File'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleCvUpload}
                      disabled={uploadingCv}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Right: directory + generate */}
          <div className="lg:col-span-8 space-y-8">
            {/* Directory */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-slate-900">Job & Gig Directory</h3>
                <button
                  type="button"
                  onClick={openMatchedSearches}
                  disabled={filteredSites.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  <Wand2 className="w-4 h-4" />
                  Open matched searches
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter sites..."
                    value={siteSearch}
                    onChange={(e) => setSiteSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {(['all', 'remote', 'freelance'] as CategoryFilter[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                        categoryFilter === cat
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSites.map((site) => (
                  <div
                    key={site.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-slate-900">{site.name}</p>
                        <span
                          className={`inline-block mt-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                            site.category === 'remote'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {site.category}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">{site.description}</p>
                    {site.notes && (
                      <p className="text-[11px] text-slate-400 italic mb-3">{site.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={site.homeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open site
                      </a>
                      <a
                        href={site.buildSearchUrl(cvKeywords)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium"
                      >
                        <Search className="w-3 h-3" />
                        Search with my skills
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Generate docs */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Generate application documents
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Paste a remote job or freelance gig description. We generate an ATS CV, cover
                letter, proposal/bid, and a short client pitch.
              </p>

              <div className="space-y-4">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                  {(['remote', 'freelance'] as EngagementType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEngagementType(type)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                        engagementType === type
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {type === 'remote' ? 'Remote role' : 'One-time / freelance'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. React Developer or Landing page build"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company / Client (optional)
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Company or client name"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job / gig description *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={8}
                    placeholder="Paste the full posting or client brief here..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                </div>

                <button
                  type="button"
                  onClick={generateDocuments}
                  disabled={generating}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold"
                >
                  <Sparkles className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
                  {generating ? 'Generating documents...' : 'Generate CV, letter, proposal & pitch'}
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {activeDocs && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex justify-center items-stretch sm:items-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-4xl sm:rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-full sm:max-h-[90vh]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{activeDocs.title}</p>
                <p className="text-xs text-slate-500 truncate">
                  {activeDocs.company || 'No company specified'} · {activeDocs.engagementType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDocs(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1 px-4 pt-3 border-b border-slate-100">
              {(
                [
                  ['cv', 'ATS CV'],
                  ['coverLetter', 'Cover letter'],
                  ['proposal', 'Proposal / bid'],
                  ['pitch', 'Short pitch'],
                ] as [DocTab, string][]
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-xs font-semibold rounded-t-md border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => downloadAsDocx(tabFilename(), activeContent())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Download Word (.docx)
              </button>
              <button
                type="button"
                onClick={downloadAllDocx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-md text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Download all (.docx)
              </button>
              <button
                type="button"
                onClick={() =>
                  printOrSavePdf('remote-preview-document-content', activeDocs.title)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-white rounded-md text-xs font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-200 flex justify-center">
              <div
                id="remote-preview-document-content"
                className="bg-white p-8 sm:p-12 shadow-lg border border-slate-300 max-w-2xl w-full min-h-[650px] font-sans text-slate-900"
              >
                {renderMarkdownText(activeContent())}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
