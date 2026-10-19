'use client';

import React from 'react';

function parseFormattedText(str: string) {
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
}

export default function MarkdownView({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="space-y-1">
      {text.split('\n').map((line, idx) => {
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
      })}
    </div>
  );
}
