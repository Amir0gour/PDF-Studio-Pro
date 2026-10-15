import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  BookOpen,
  Calendar,
  ListCheck,
  Languages,
  HelpCircle
} from 'lucide-react';
import { PDFDocumentModel } from '../types/pdf';
import { getPdfJsDocument, extractAllText } from '../services/pdfRenderer';

interface AiViewProps {
  currentDocument: PDFDocumentModel | null;
  onOpenSample: () => void;
}

export const AiView: React.FC<AiViewProps> = ({ currentDocument, onOpenSample }) => {
  const [selectedTask, setSelectedTask] = useState<string>('summarize');
  const [customQuery, setCustomQuery] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('Spanish');
  const [loading, setLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');

  React.useEffect(() => {
    if (!currentDocument) {
      setExtractedText('');
      return;
    }
    getPdfJsDocument(currentDocument.data)
      .then(pdf => extractAllText(pdf))
      .then(res => setExtractedText(res.fullText))
      .catch(err => console.error('Error extracting text in AiView', err));
  }, [currentDocument]);

  const tasks = [
    {
      id: 'summarize',
      title: 'Executive Summary',
      desc: 'Generate an executive overview with key themes and conclusions',
      icon: BookOpen,
    },
    {
      id: 'key_points',
      title: 'Key Takeaways',
      desc: 'Extract top bullet-point takeaways and findings',
      icon: ListCheck,
    },
    {
      id: 'action_items',
      title: 'Deadlines & Deliverables',
      desc: 'Identify actionable decisions, deliverables, and calendar dates',
      icon: Calendar,
    },
    {
      id: 'revision_notes',
      title: 'Study & Revision Guide',
      desc: 'Create structured high-yield revision cards and review questions',
      icon: HelpCircle,
    },
    {
      id: 'translate',
      title: 'Translate Document',
      desc: 'Translate contents into Spanish, French, German, or Japanese',
      icon: Languages,
    },
  ];

  const handleRunAi = async () => {
    if (!currentDocument) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      setAiResult(null);

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: extractedText || currentDocument.name,
          task: selectedTask,
          query: customQuery,
          targetLanguage: targetLang,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAiResult(data.result);
    } catch (err: any) {
      setErrorMsg(err.message || 'AI document processing failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Document Intelligence Copilot</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI PDF Assistant</h1>
          <p className="text-sm text-slate-500 mt-1">
            Grounded analysis, semantic summarization, and key item extraction powered by Gemini 3.8 Flash.
          </p>
        </div>

        {currentDocument ? (
          <div className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
            <FileText className="w-4 h-4 text-slate-500" />
            <div>
              <div className="font-semibold text-slate-900 truncate max-w-[200px]">
                {currentDocument.name}
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                {currentDocument.pageCount} pages
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenSample}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            Load Sample Document for AI
          </button>
        )}
      </div>

      {/* Task Selector & Query Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Task Choices & Inputs */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Analysis Task
            </h3>
            <div className="space-y-2">
              {tasks.map((t) => {
                const IconComp = t.icon;
                const isSelected = selectedTask === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTask(t.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-md ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{t.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedTask === 'translate' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Language
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="Spanish">Spanish (Español)</option>
                  <option value="French">French (Français)</option>
                  <option value="German">German (Deutsch)</option>
                  <option value="Japanese">Japanese (日本語)</option>
                  <option value="Mandarin Chinese">Chinese (中文)</option>
                </select>
              </div>
            )}

            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Custom Question or Specific Focus (Optional)
              </label>
              <textarea
                rows={3}
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="e.g. Focus on financial metrics, or explain section 3..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
              />
            </div>

            <button
              onClick={handleRunAi}
              disabled={loading || !currentDocument}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Processing with Gemini 3.8 Flash...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Run AI Document Intelligence</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results Viewport */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[480px] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Analysis Output
                </span>
                {aiResult && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Output</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              {loading && (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                  <p className="text-xs">
                    Synthesizing document text, validating assertions, and constructing response...
                  </p>
                </div>
              )}

              {!loading && !aiResult && !errorMsg && (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Ready for Document Analysis</p>
                  <p className="text-xs max-w-sm mx-auto">
                    Select a task on the left and click "Run AI Document Intelligence" to analyze your PDF.
                  </p>
                </div>
              )}

              {!loading && aiResult && (
                <div className="prose prose-slate prose-xs max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {aiResult}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Grounding: Document Content</span>
              <span>Model: Gemini 3.8 Flash</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
