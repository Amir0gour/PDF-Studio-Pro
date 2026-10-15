import React, { useState } from 'react';
import {
  Upload,
  Layers,
  Scissors,
  FileSignature,
  FileText,
  Lock,
  Minimize2,
  Sparkles,
  Table,
  Image as ImageIcon,
  ShieldCheck,
  Search,
  ArrowRight,
  FolderOpen,
  FileCheck,
  RotateCw,
  Highlighter,
  Sliders,
  Clock,
  Download
} from 'lucide-react';
import { PDFDocumentModel, ProcessingHistoryItem, ToolCategory, ToolDefinition } from '../types/pdf';
import { formatBytes } from '../services/pdfLogic';

interface DashboardProps {
  onUploadFile: (file: File) => void;
  onOpenSample: () => void;
  onSelectTool: (toolId: string) => void;
  onOpenEditor: () => void;
  currentDocument: PDFDocumentModel | null;
  history: ProcessingHistoryItem[];
  onDownloadHistoryItem: (item: ProcessingHistoryItem) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onUploadFile,
  onOpenSample,
  onSelectTool,
  onOpenEditor,
  currentDocument,
  history,
  onDownloadHistoryItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const tools: ToolDefinition[] = [
    // Organize
    {
      id: 'merge',
      title: 'Merge PDF',
      category: 'organize',
      description: 'Combine multiple PDFs into a unified sequential document',
      iconName: 'Layers',
      actionType: 'modal',
      isAvailable: true,
    },
    {
      id: 'split',
      title: 'Split & Extract',
      category: 'organize',
      description: 'Extract custom page ranges or split documents into parts',
      iconName: 'Scissors',
      actionType: 'modal',
      isAvailable: true,
    },
    {
      id: 'reorder',
      title: 'Reorder & Organize',
      category: 'organize',
      description: 'Drag, rotate, and rearrange pages in the visual thumbnail view',
      iconName: 'Sliders',
      actionType: 'editor',
      isAvailable: true,
    },
    {
      id: 'rotate',
      title: 'Rotate Pages',
      category: 'organize',
      description: 'Rotate pages 90°, 180°, or 270° clockwise or counterclockwise',
      iconName: 'RotateCw',
      actionType: 'editor',
      isAvailable: true,
    },

    // Edit
    {
      id: 'annotate',
      title: 'Annotate & Draw',
      category: 'edit',
      description: 'Add highlights, underlines, freehand drawings, and geometric shapes',
      iconName: 'Highlighter',
      actionType: 'editor',
      isAvailable: true,
    },
    {
      id: 'sign',
      title: 'Digital Signature',
      category: 'edit',
      description: 'Draw or type legally styled signatures and stamp onto pages',
      iconName: 'FileSignature',
      actionType: 'editor',
      isAvailable: true,
    },
    {
      id: 'whiteout',
      title: 'Redact & Overlay',
      category: 'edit',
      description: 'Whiteout sensitive regions and overlay replacement text',
      iconName: 'FileText',
      actionType: 'editor',
      isAvailable: true,
    },

    // Convert
    {
      id: 'pdf_to_images',
      title: 'PDF to Images',
      category: 'convert',
      description: 'Export all pages as crisp high-resolution PNG or JPEG images',
      iconName: 'ImageIcon',
      actionType: 'modal',
      isAvailable: true,
    },
    {
      id: 'images_to_pdf',
      title: 'Images to PDF',
      category: 'convert',
      description: 'Combine PNG and JPG photos into a single formatted PDF file',
      iconName: 'FileText',
      actionType: 'modal',
      isAvailable: true,
    },
    {
      id: 'table_csv',
      title: 'Extract Tables (CSV)',
      category: 'convert',
      description: 'Scan tabular sections and export structured CSV spreadsheets',
      iconName: 'Table',
      actionType: 'modal',
      isAvailable: true,
    },

    // Optimize
    {
      id: 'compress',
      title: 'Optimize & Compress',
      category: 'optimize',
      description: 'Reduce PDF file size with stream compression presets',
      iconName: 'Minimize2',
      actionType: 'modal',
      isAvailable: true,
    },

    // Security
    {
      id: 'security',
      title: 'Password Protection',
      category: 'security',
      description: 'Encrypt PDFs with standard password-based permission locks',
      iconName: 'Lock',
      actionType: 'modal',
      isAvailable: true,
    },

    // Analyze
    {
      id: 'ai_copilot',
      title: 'AI Document Intelligence',
      category: 'analyze',
      description: 'Summarize, answer questions, and extract critical action items',
      iconName: 'Sparkles',
      actionType: 'editor',
      isAvailable: true,
    },
    {
      id: 'ocr',
      title: 'Vision OCR (Scanned)',
      category: 'analyze',
      description: 'Transcribe unselectable scanned pages using Gemini Vision OCR',
      iconName: 'Sparkles',
      actionType: 'modal',
      isAvailable: true,
    },
  ];

  // Filtering
  const filteredTools = tools.filter((tool) => {
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesSearch =
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      {/* 1. HERO SECTION & UPLOAD DROPZONE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Hero Brief */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <span>Client-Native Architecture</span>
              <span aria-hidden="true">·</span>
              <span>Zero Remote Storage</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
              Professional All-in-One PDF Editor & Processing Workspace
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed max-w-xl">
              Edit, annotate, merge, split, compress, protect, and analyze PDF documents with real client-side execution and intelligent AI assistance. Zero telemetry, private memory sandbox.
            </p>
          </div>

          {/* Quick Actions & Demo Trigger */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onOpenSample}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
            >
              <FolderOpen className="w-4 h-4 text-rose-400" />
              <span>Load Interactive Demo Document</span>
            </button>
            {currentDocument && (
              <button
                onClick={onOpenEditor}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-medium rounded-lg transition-colors"
              >
                <span>Continue Editing ({currentDocument.name})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Privacy Guarantee Note */}
          <div className="flex items-start gap-3 p-3.5 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">Privacy-First Execution:</span> All
              standard PDF modifications run locally in your browser session. Files are never stored on external servers.
            </div>
          </div>
        </div>

        {/* Right Drag & Drop Zone */}
        <div className="lg:col-span-6 flex flex-col">
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]'
                : 'border-slate-300 hover:border-slate-400 bg-white shadow-xs'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 mb-4 group-hover:scale-105 transition-transform">
              <Upload className="w-7 h-7 text-indigo-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Upload PDF or Drop Document Here
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              Select any PDF file from your device to begin editing, annotating, or transforming pages
            </p>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors">
              Browse Files
            </span>
            <input
              type="file"
              accept="application/pdf, image/png, image/jpeg"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onUploadFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 2. SEARCHABLE TOOL MATRIX */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">PDF Tool Suite</h2>
            <p className="text-xs text-slate-500">Every tool is fully functional with client-side processing</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter segmented buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'all', label: 'All Tools' },
                { id: 'organize', label: 'Organize' },
                { id: 'edit', label: 'Edit' },
                { id: 'convert', label: 'Convert' },
                { id: 'optimize', label: 'Optimize' },
                { id: 'security', label: 'Security' },
                { id: 'analyze', label: 'Analyze' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 w-44"
              />
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => {
                if (tool.actionType === 'editor') {
                  onOpenEditor();
                } else {
                  onSelectTool(tool.id);
                }
              }}
              className="p-5 bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl cursor-pointer transition-all hover:shadow-xs group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                    {tool.id === 'merge' && <Layers className="w-4 h-4" />}
                    {tool.id === 'split' && <Scissors className="w-4 h-4" />}
                    {tool.id === 'reorder' && <Sliders className="w-4 h-4" />}
                    {tool.id === 'rotate' && <RotateCw className="w-4 h-4" />}
                    {tool.id === 'annotate' && <Highlighter className="w-4 h-4" />}
                    {tool.id === 'sign' && <FileSignature className="w-4 h-4" />}
                    {tool.id === 'whiteout' && <FileText className="w-4 h-4" />}
                    {tool.id === 'pdf_to_images' && <ImageIcon className="w-4 h-4" />}
                    {tool.id === 'images_to_pdf' && <FileText className="w-4 h-4" />}
                    {tool.id === 'table_csv' && <Table className="w-4 h-4" />}
                    {tool.id === 'compress' && <Minimize2 className="w-4 h-4" />}
                    {tool.id === 'security' && <Lock className="w-4 h-4" />}
                    {tool.id === 'ai_copilot' && <Sparkles className="w-4 h-4 text-indigo-500" />}
                    {tool.id === 'ocr' && <Sparkles className="w-4 h-4 text-amber-500" />}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 capitalize">
                    {tool.category}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {tool.title}
                </h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium group-hover:text-slate-900">
                <span>Launch Tool</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. RECENT PROCESSING HISTORY */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Processing Audit History</h3>
            <p className="text-xs text-slate-500">Log of actions executed during this session</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {history.length} Record{history.length === 1 ? '' : 's'}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg text-xs text-slate-500">
            No document transformations logged yet. Open or transform a document to generate history.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3.5 text-xs hover:bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-semibold text-slate-900">{item.toolName}</span>
                    <span className="text-slate-400 ml-2">· {item.fileName}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.detail}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {item.timestamp}
                  </span>
                  {item.downloadData && (
                    <button
                      onClick={() => onDownloadHistoryItem(item)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
