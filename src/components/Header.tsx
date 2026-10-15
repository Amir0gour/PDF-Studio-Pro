import React from 'react';
import { FileText, Download, Sparkles, FolderOpen } from 'lucide-react';
import { PDFDocumentModel } from '../types/pdf';

interface HeaderProps {
  currentTab: 'dashboard' | 'editor' | 'tools' | 'ai' | 'history';
  onSelectTab: (tab: 'dashboard' | 'editor' | 'tools' | 'ai' | 'history') => void;
  currentDocument: PDFDocumentModel | null;
  onDownload: () => void;
  onOpenSample: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  currentDocument,
  onDownload,
  onOpenSample,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('dashboard');
          }}
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs group-hover:bg-slate-800 transition-colors">
            <FileText className="w-4 h-4 text-rose-400" />
          </div>
          <span>PDF Studio Pro</span>
        </a>

        {/* Zone 2: 4–5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              currentTab === 'dashboard'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab('editor')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              currentTab === 'editor'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Editor & Annotations
          </button>
          <button
            onClick={() => onSelectTab('tools')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              currentTab === 'tools'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Tools Hub
          </button>
          <button
            onClick={() => onSelectTab('ai')}
            className={`flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 py-1 ${
              currentTab === 'ai'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            AI Assistant
          </button>
          <button
            onClick={() => onSelectTab('history')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              currentTab === 'history'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Processing History
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentDocument ? (
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          ) : (
            <button
              onClick={onOpenSample}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 border border-slate-200/80"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-600" />
              Load Demo PDF
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
