import React from 'react';
import {
  Layers,
  Scissors,
  Sliders,
  RotateCw,
  Highlighter,
  FileSignature,
  FileText,
  ImageIcon,
  Table,
  Minimize2,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { PDFDocumentModel, ToolCategory } from '../types/pdf';

interface ToolsHubProps {
  onSelectTool: (toolId: string) => void;
  onOpenEditor: () => void;
  currentDocument: PDFDocumentModel | null;
}

export const ToolsHub: React.FC<ToolsHubProps> = ({
  onSelectTool,
  onOpenEditor,
  currentDocument,
}) => {
  const categories: {
    category: ToolCategory;
    title: string;
    description: string;
    tools: {
      id: string;
      title: string;
      description: string;
      icon: any;
      type: 'modal' | 'editor';
    }[];
  }[] = [
    {
      category: 'organize',
      title: 'Organize Pages',
      description: 'Rearrange, merge, split, and clean document layouts',
      tools: [
        {
          id: 'merge',
          title: 'Merge PDF Documents',
          description: 'Combine multiple PDF files into one clean sequential document.',
          icon: Layers,
          type: 'modal',
        },
        {
          id: 'split',
          title: 'Split & Extract Pages',
          description: 'Extract specific pages or page intervals into a new document.',
          icon: Scissors,
          type: 'modal',
        },
        {
          id: 'reorder',
          title: 'Visual Page Reorder',
          description: 'Drag and reorder page sequences in the visual thumbnail view.',
          icon: Sliders,
          type: 'editor',
        },
        {
          id: 'rotate',
          title: 'Rotate Pages',
          description: 'Adjust page orientation by 90°, 180°, or 270° clockwise.',
          icon: RotateCw,
          type: 'editor',
        },
      ],
    },
    {
      category: 'edit',
      title: 'Edit & Annotate',
      description: 'Overlay text, draw shapes, highlight, and sign documents',
      tools: [
        {
          id: 'annotate',
          title: 'Highlighter & Drawing Pen',
          description: 'Highlight text passages and sketch freehand notes on pages.',
          icon: Highlighter,
          type: 'editor',
        },
        {
          id: 'sign',
          title: 'Digital Signature Stamp',
          description: 'Draw or type executive signatures and place on documents.',
          icon: FileSignature,
          type: 'editor',
        },
        {
          id: 'whiteout',
          title: 'Redaction & Overlay Edit',
          description: 'Mask existing regions with whiteout and place replacement text.',
          icon: FileText,
          type: 'editor',
        },
      ],
    },
    {
      category: 'convert',
      title: 'Convert & Export',
      description: 'Format-aware export to and from PDF',
      tools: [
        {
          id: 'pdf_to_images',
          title: 'PDF to Images (PNG/JPG)',
          description: 'Export all pages as high-resolution images bundled in ZIP.',
          icon: ImageIcon,
          type: 'modal',
        },
        {
          id: 'images_to_pdf',
          title: 'Images to PDF Converter',
          description: 'Transform multiple PNG or JPEG pictures into a formatted PDF.',
          icon: FileText,
          type: 'modal',
        },
        {
          id: 'table_csv',
          title: 'Table Extraction to CSV',
          description: 'Parse structured tables into clean comma-separated values.',
          icon: Table,
          type: 'modal',
        },
      ],
    },
    {
      category: 'optimize',
      title: 'Optimize & Protect',
      description: 'Compress file sizes and secure sensitive content',
      tools: [
        {
          id: 'compress',
          title: 'Stream Optimizer & Compressor',
          description: 'Downsample object streams and strip unused metadata.',
          icon: Minimize2,
          type: 'modal',
        },
        {
          id: 'security',
          title: 'Password Encryption',
          description: 'Set authorization credentials and permissions on documents.',
          icon: Lock,
          type: 'modal',
        },
      ],
    },
    {
      category: 'analyze',
      title: 'AI Analysis & OCR',
      description: 'Multimodal vision and natural language intelligence',
      tools: [
        {
          id: 'ai_copilot',
          title: 'Document AI Assistant',
          description: 'Executive summaries, Q&A, and action item detection.',
          icon: Sparkles,
          type: 'editor',
        },
        {
          id: 'ocr',
          title: 'Multimodal Scanned OCR',
          description: 'Transcribe scanned unselectable documents using Gemini Vision.',
          icon: Sparkles,
          type: 'modal',
        },
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">All PDF Tools</h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore the full suite of client-side and AI-powered document manipulation tools.
        </p>
      </div>

      <div className="space-y-8">
        {categories.map((catGroup) => (
          <div key={catGroup.category} className="space-y-3">
            <div className="border-b border-slate-200 pb-2 flex items-baseline justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">{catGroup.title}</h2>
                <p className="text-xs text-slate-500">{catGroup.description}</p>
              </div>
              <span className="text-xs font-mono text-slate-400 capitalize">
                {catGroup.tools.length} Tools
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catGroup.tools.map((tool) => {
                const IconComp = tool.icon;
                return (
                  <div
                    key={tool.id}
                    onClick={() => {
                      if (tool.type === 'editor') {
                        onOpenEditor();
                      } else {
                        onSelectTool(tool.id);
                      }
                    }}
                    className="p-5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer transition-all hover:shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors mb-3">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {tool.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-600 group-hover:text-slate-900">
                      <span>{tool.type === 'editor' ? 'Open in Editor' : 'Configure & Run'}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
