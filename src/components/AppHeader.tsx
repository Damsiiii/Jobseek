'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Settings, Key, X, CheckCircle, Globe } from 'lucide-react';

export default function AppHeader() {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  useEffect(() => {
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
    fetchSettings();
  }, []);

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

  const navLinkClass = (href: string) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href));
    return `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active
        ? 'bg-indigo-600 text-white'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;
  };

  return (
    <>
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="bg-indigo-600 p-2 rounded-lg flex-shrink-0">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight truncate">LankaIntern AI</h1>
              <p className="text-xs text-slate-400 truncate hidden sm:block">
                Internships, remote roles & freelance docs
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/" className={navLinkClass('/')}>
              Internships
            </Link>
            <Link href="/remote" className={`${navLinkClass('/remote')} flex items-center gap-1.5`}>
              <Globe className="w-3.5 h-3.5 hidden sm:inline" />
              Remote & Freelance
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="ml-1 sm:ml-2 flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-sm transition-colors border border-slate-700"
            >
              <Settings className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">LLM Settings</span>
            </button>
          </nav>
        </div>
      </header>

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
              Configure your free Google Gemini API key to customize resumes and generate cover
              letters, proposals, and pitches. If left blank, the built-in ATS engine formats
              documents automatically.
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
    </>
  );
}
