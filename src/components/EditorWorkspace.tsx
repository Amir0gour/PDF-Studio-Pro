import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Underline,
  Strikethrough,
  PenTool,
  Square,
  Circle,
  Type,
  StickyNote,
  FileSignature,
  Eraser,
  Undo2,
  Redo2,
  Download,
  Sparkles,
  Info,
  Sliders,
  Send,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Minus,
  Stamp,
  Check,
  X as CloseIcon,
  Image as ImageIcon,
  Hash,
  Droplets,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  ShieldAlert,
  Calendar,
  MessageSquare,
  Plus,
  Palette,
  Edit3,
  Save
} from 'lucide-react';
import { ActiveTool, Annotation, PDFDocumentModel } from '../types/pdf';
import {
  getPdfJsDocument,
  renderPageToCanvas,
  generatePageThumbnail,
  extractAllText
} from '../services/pdfRenderer';
import {
  rotatePages,
  deletePages,
  duplicatePage,
  reorderPages,
  embedAnnotationsToPdf,
  loadPdfModel,
  addWatermarkToAllPages,
  addPageNumbersToPdf
} from '../services/pdfEngine';
import { formatBytes, analyzeTextContent } from '../services/pdfLogic';
import { SignatureModal } from './SignatureModal';

interface EditorWorkspaceProps {
  document: PDFDocumentModel;
  onUpdateDocument: (updated: PDFDocumentModel, actionDesc?: string) => void;
  onDownload: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  document: docModel,
  onUpdateDocument,
  onDownload,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.25);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');

  // Annotation styling
  const [toolColor, setToolColor] = useState<string>('#f59e0b');
  const [toolStrokeWidth, setToolStrokeWidth] = useState<number>(3);
  const [toolFontSize, setToolFontSize] = useState<number>(14);
  const [toolFontWeight, setToolFontWeight] = useState<'normal' | 'bold'>('normal');
  const [toolFontStyle, setToolFontStyle] = useState<'normal' | 'italic'>('normal');
  const [toolOpacity, setToolOpacity] = useState<number>(1.0);

  // Selected annotation & dragging/resizing state
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isDraggingAnn, setIsDraggingAnn] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isResizingAnn, setIsResizingAnn] = useState<boolean>(false);
  const [resizeStart, setResizeStart] = useState<{ pctX: number; pctY: number; origWidth: number; origHeight: number } | null>(null);

  // Stamp picker popup
  const [showStampPicker, setShowStampPicker] = useState<boolean>(false);

  // History for Undo/Redo
  const [annotationHistory, setAnnotationHistory] = useState<Annotation[][]>([docModel.annotations || []]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Right sidebar tab
  const [rightTab, setRightTab] = useState<'properties' | 'inspect' | 'ai'>('properties');

  // AI chat & analysis state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<
    { role: 'user' | 'assistant'; text: string; timestamp: string }[]
  >([
    {
      role: 'assistant',
      text: `Hello! I'm your AI Document Assistant for "${docModel.name}". Ask me to summarize this document, explain sections, extract key takeaways, or find important deadlines.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Thumbnails cache
  const [thumbnails, setThumbnails] = useState<{ [pageNum: number]: string }>({});

  // Document full text & stats
  const [extractedFullText, setExtractedFullText] = useState<string>('');
  const [textStats, setTextStats] = useState({ wordCount: 0, charCount: 0, readingTimeMinutes: 0, lineCount: 0 });

  // Signature Modal
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  // Search in doc
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);

  // Canvas and Layer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [pdfJsDoc, setPdfJsDoc] = useState<any>(null);
  const [renderDims, setRenderDims] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

  // Native text selection & floating contextual action bar state
  const [selectedTextInfo, setSelectedTextInfo] = useState<{
    text: string;
    pctX: number;
    pctY: number;
    pctW: number;
    pctH: number;
    topPx: number;
    leftPx: number;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Freehand / Shape creation state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ pctX: number; pctY: number } | null>(null);
  const [tempPoints, setTempPoints] = useState<{ x: number; y: number }[]>([]);

  // Load PDF.js doc instance on document change
  useEffect(() => {
    let isMounted = true;
    getPdfJsDocument(docModel.data)
      .then(async (pdf) => {
        if (!isMounted) return;
        setPdfJsDoc(pdf);

        // Generate thumbnails for pages
        const thumbs: { [num: number]: string } = {};
        for (let i = 1; i <= Math.min(pdf.numPages, 12); i++) {
          try {
            const dataUrl = await generatePageThumbnail(pdf, i, 140);
            thumbs[i] = dataUrl;
          } catch (e) {
            console.error('Thumb error', e);
          }
        }
        if (isMounted) setThumbnails(thumbs);

        // Extract full text
        try {
          const { fullText } = await extractAllText(pdf);
          if (isMounted) {
            setExtractedFullText(fullText);
            setTextStats(analyzeTextContent(fullText));
          }
        } catch (e) {
          console.error('Text extraction error', e);
        }
      })
      .catch((err) => console.error('Failed to load PDF in PDF.js', err));

    return () => {
      isMounted = false;
    };
  }, [docModel.data]);

  // Render current page when page, zoom or pdfJsDoc changes
  useEffect(() => {
    if (!pdfJsDoc || !canvasRef.current) return;
    renderPageToCanvas(pdfJsDoc, currentPage, canvasRef.current, zoomScale, 0, textLayerRef.current)
      .then((res) => {
        setRenderDims({ width: res.width, height: res.height });
      })
      .catch((err) => console.error('Render error:', err));
  }, [pdfJsDoc, currentPage, zoomScale]);

  // Handle Search
  useEffect(() => {
    if (!searchQuery.trim() || !extractedFullText) {
      setSearchMatches([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches: number[] = [];
    const pageChunks = extractedFullText.split(/\[Page (\d+)\]/);
    for (let i = 1; i < pageChunks.length; i += 2) {
      const pageNum = parseInt(pageChunks[i], 10);
      const content = pageChunks[i + 1] || '';
      if (content.toLowerCase().includes(q)) {
        matches.push(pageNum);
      }
    }
    setSearchMatches(matches);
  }, [searchQuery, extractedFullText]);

  // Keyboard shortcuts (Escape to deselect/save, Delete to remove selected annotation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        deselectAllAndSave();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId && !editingTextId) {
        // Only if not actively typing inside an input/textarea
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        e.preventDefault();
        deleteSelectedAnnotation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotationId, editingTextId, selectedTextInfo, docModel.annotations]);

  // Deselect any active object, finish text editing, dismiss popups, and commit changes
  const deselectAllAndSave = () => {
    if (selectedAnnotationId || editingTextId) {
      commitAnnotations(docModel.annotations);
      setSelectedAnnotationId(null);
      setEditingTextId(null);
    }
    if (selectedTextInfo) {
      setSelectedTextInfo(null);
    }
    setShowStampPicker(false);
  };

  const deleteSelectedAnnotation = () => {
    if (!selectedAnnotationId) return;
    const updated = docModel.annotations.filter((a) => a.id !== selectedAnnotationId);
    commitAnnotations(updated);
    setSelectedAnnotationId(null);
    setEditingTextId(null);
  };

  const duplicateSelectedAnnotation = () => {
    if (!selectedAnnotationId) return;
    const ann = docModel.annotations.find((a) => a.id === selectedAnnotationId);
    if (!ann) return;
    const dup: Annotation = {
      ...ann,
      id: `ann_${Date.now()}`,
      x: Math.min(ann.x + 3, 90),
      y: Math.min(ann.y + 3, 90),
    };
    commitAnnotations([...docModel.annotations, dup]);
    setSelectedAnnotationId(dup.id);
  };

  const commitAnnotations = (newAnns: Annotation[]) => {
    const newHist = annotationHistory.slice(0, historyIndex + 1);
    newHist.push(newAnns);
    setAnnotationHistory(newHist);
    setHistoryIndex(newHist.length - 1);
    onUpdateDocument({ ...docModel, annotations: newAnns });
  };

  // Page Operations
  const handleRotateCurrentPage = async (deg: number) => {
    try {
      const pageIndex = currentPage - 1;
      const updatedBytes = await rotatePages(docModel.data, [pageIndex], deg);
      const updatedModel = await loadPdfModel(updatedBytes, docModel.name);
      updatedModel.annotations = docModel.annotations;
      onUpdateDocument(updatedModel, `Rotated Page ${currentPage}`);
    } catch (e: any) {
      alert(e.message || 'Rotation failed');
    }
  };

  const handleDeleteCurrentPage = async () => {
    if (docModel.pageCount <= 1) {
      alert('Cannot delete the only page of a document.');
      return;
    }
    if (!confirm(`Are you sure you want to delete Page ${currentPage}?`)) return;
    try {
      const pageIndex = currentPage - 1;
      const updatedBytes = await deletePages(docModel.data, [pageIndex]);
      const updatedModel = await loadPdfModel(updatedBytes, docModel.name);
      updatedModel.annotations = docModel.annotations
        .filter((a) => a.pageIndex !== pageIndex)
        .map((a) => (a.pageIndex > pageIndex ? { ...a, pageIndex: a.pageIndex - 1 } : a));

      if (currentPage > updatedModel.pageCount) {
        setCurrentPage(updatedModel.pageCount);
      }
      onUpdateDocument(updatedModel, `Deleted Page ${currentPage}`);
    } catch (e: any) {
      alert(e.message || 'Delete page failed');
    }
  };

  const handleDuplicateCurrentPage = async () => {
    try {
      const pageIndex = currentPage - 1;
      const updatedBytes = await duplicatePage(docModel.data, pageIndex);
      const updatedModel = await loadPdfModel(updatedBytes, docModel.name);
      onUpdateDocument(updatedModel, `Duplicated Page ${currentPage}`);
    } catch (e: any) {
      alert(e.message || 'Duplicate page failed');
    }
  };

  const handleMovePage = async (direction: 'up' | 'down') => {
    const fromIndex = currentPage - 1;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= docModel.pageCount) return;

    const newOrder = Array.from({ length: docModel.pageCount }, (_, i) => i);
    newOrder[fromIndex] = toIndex;
    newOrder[toIndex] = fromIndex;

    try {
      const updatedBytes = await reorderPages(docModel.data, newOrder);
      const updatedModel = await loadPdfModel(updatedBytes, docModel.name);
      setCurrentPage(toIndex + 1);
      onUpdateDocument(updatedModel, `Moved Page ${direction}`);
    } catch (e: any) {
      alert(e.message || 'Reorder failed');
    }
  };

  // Add Watermark across all pages (Paid Feature)
  const handleApplyWatermark = async () => {
    const text = prompt('Enter watermark text to apply across all pages:', 'CONFIDENTIAL');
    if (!text) return;
    try {
      const updatedBytes = await addWatermarkToAllPages(docModel.data, text, 0.22);
      const updatedModel = await loadPdfModel(updatedBytes, docModel.name);
      updatedModel.annotations = docModel.annotations;
      onUpdateDocument(updatedModel, `Applied Watermark: "${text}"`);
    } catch (e: any) {
      alert(e.message || 'Failed to apply watermark');
    }
  };

  // Add Page Numbers / Bates across all pages (Paid Feature)
  const handleApplyPageNumbers = async () => {
    try {
      const updatedBytes = await addPageNumbersToPdf(docModel.data, 'Page {n} of {total}', 'bottom-center');
      const updatedModel = await loadPdfModel(updatedBytes, docModel.name);
      updatedModel.annotations = docModel.annotations;
      onUpdateDocument(updatedModel, 'Applied Page Numbering');
    } catch (e: any) {
      alert(e.message || 'Failed to apply page numbers');
    }
  };

  // Add Stamp annotation
  const handleAddStamp = (stampText: string) => {
    const newStamp: Annotation = {
      id: `stamp_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: 'stamp',
      x: 35,
      y: 20,
      width: 30,
      height: 10,
      color: stampText.includes('CONFIDENTIAL') || stampText.includes('VOID') ? '#dc2626' : '#16a34a',
      strokeWidth: 2,
      opacity: 0.95,
      stampType: stampText,
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, newStamp]);
    setSelectedAnnotationId(newStamp.id);
    setShowStampPicker(false);
    setActiveTool('select');
  };

  // Add Checkmark or Cross mark
  const handleAddQuickMark = (type: 'check' | 'cross') => {
    const newMark: Annotation = {
      id: `mark_${Date.now()}`,
      pageIndex: currentPage - 1,
      type,
      x: 45,
      y: 35,
      width: 8,
      height: 8,
      color: type === 'check' ? '#16a34a' : '#dc2626',
      strokeWidth: 3,
      opacity: 1.0,
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, newMark]);
    setSelectedAnnotationId(newMark.id);
    setActiveTool('select');
  };

  // Insert Image onto PDF
  const handleInsertImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const imageAnn: Annotation = {
          id: `img_${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'image',
          x: 30,
          y: 30,
          width: 30,
          height: 20,
          color: '#000000',
          strokeWidth: 0,
          opacity: 1.0,
          imageDataUrl: reader.result as string,
          createdAt: new Date().toISOString(),
        };
        commitAnnotations([...docModel.annotations, imageAnn]);
        setSelectedAnnotationId(imageAnn.id);
        setActiveTool('select');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = annotationHistory[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onUpdateDocument({ ...docModel, annotations: prev });
      setSelectedAnnotationId(null);
      setEditingTextId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < annotationHistory.length - 1) {
      const next = annotationHistory[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onUpdateDocument({ ...docModel, annotations: next });
      setSelectedAnnotationId(null);
      setEditingTextId(null);
    }
  };

  // Relative coordinate calculator (supports both React synthetic and native Window events)
  const getRelativeCoords = (e: React.MouseEvent | MouseEvent) => {
    if (!overlayRef.current) return { pctX: 0, pctY: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, (y / rect.height) * 100));
    return { pctX, pctY };
  };

  // Handle text selection on PDF text layer
  const handleCheckTextSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      return;
    }
    const text = sel.toString().trim();
    if (!text) return;

    if (!overlayRef.current) return;
    const overlayRect = overlayRef.current.getBoundingClientRect();

    try {
      const range = sel.getRangeAt(0);
      const rangeRect = range.getBoundingClientRect();

      // Ensure the selection is actually inside our page
      if (
        rangeRect.right < overlayRect.left ||
        rangeRect.left > overlayRect.right ||
        rangeRect.bottom < overlayRect.top ||
        rangeRect.top > overlayRect.bottom
      ) {
        return;
      }

      const pctX = Math.max(0, Math.min(100, ((rangeRect.left - overlayRect.left) / overlayRect.width) * 100));
      const pctY = Math.max(0, Math.min(100, ((rangeRect.top - overlayRect.top) / overlayRect.height) * 100));
      const pctW = Math.max(2, Math.min(100, (rangeRect.width / overlayRect.width) * 100));
      const pctH = Math.max(1.5, Math.min(100, (rangeRect.height / overlayRect.height) * 100));

      const topPx = Math.max(8, rangeRect.top - overlayRect.top - 46);
      const leftPx = Math.max(8, Math.min(overlayRect.width - 280, rangeRect.left - overlayRect.left));

      setSelectedTextInfo({
        text,
        pctX,
        pctY,
        pctW,
        pctH,
        topPx,
        leftPx,
      });
    } catch {
      // Ignore range errors
    }
  };

  const handleCopySelectedText = () => {
    if (!selectedTextInfo) return;
    navigator.clipboard.writeText(selectedTextInfo.text);
    setCopyFeedback(true);
    setTimeout(() => {
      setCopyFeedback(false);
      setSelectedTextInfo(null);
    }, 1200);
  };

  const handleHighlightSelection = () => {
    if (!selectedTextInfo) return;
    const newHighlight: Annotation = {
      id: `highlight_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: 'highlight',
      x: selectedTextInfo.pctX,
      y: selectedTextInfo.pctY,
      width: selectedTextInfo.pctW,
      height: selectedTextInfo.pctH,
      color: toolColor === '#0f172a' ? '#fde047' : toolColor,
      strokeWidth: 1,
      opacity: 0.45,
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, newHighlight]);
    setSelectedTextInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleUnderlineSelection = () => {
    if (!selectedTextInfo) return;
    const newUnderline: Annotation = {
      id: `underline_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: 'underline',
      x: selectedTextInfo.pctX,
      y: selectedTextInfo.pctY + selectedTextInfo.pctH * 0.9,
      width: selectedTextInfo.pctW,
      height: 1.5,
      color: '#2563eb',
      strokeWidth: 2,
      opacity: 1.0,
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, newUnderline]);
    setSelectedTextInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleStrikethroughSelection = () => {
    if (!selectedTextInfo) return;
    const newStrike: Annotation = {
      id: `strike_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: 'strikethrough',
      x: selectedTextInfo.pctX,
      y: selectedTextInfo.pctY + selectedTextInfo.pctH * 0.45,
      width: selectedTextInfo.pctW,
      height: 1.5,
      color: '#dc2626',
      strokeWidth: 2,
      opacity: 1.0,
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, newStrike]);
    setSelectedTextInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleEditReplaceSelection = () => {
    if (!selectedTextInfo) return;
    const newEditableText: Annotation = {
      id: `text_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: 'text',
      x: selectedTextInfo.pctX,
      y: selectedTextInfo.pctY,
      width: Math.max(selectedTextInfo.pctW, 16),
      height: Math.max(selectedTextInfo.pctH, 5),
      color: '#0f172a',
      backgroundColor: '#ffffff',
      borderStyle: 'dashed',
      strokeWidth: 1,
      opacity: 1.0,
      fontSize: toolFontSize || 14,
      text: selectedTextInfo.text,
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, newEditableText]);
    setSelectedAnnotationId(newEditableText.id);
    setEditingTextId(newEditableText.id);
    setSelectedTextInfo(null);
    window.getSelection()?.removeAllRanges();
    setRightTab('properties');
  };

  const handleRedactSelection = () => {
    if (!selectedTextInfo) return;
    const newRedact: Annotation = {
      id: `redact_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: 'blackout',
      x: selectedTextInfo.pctX,
      y: selectedTextInfo.pctY,
      width: selectedTextInfo.pctW,
      height: selectedTextInfo.pctH,
      color: '#000000',
      strokeWidth: 1,
      opacity: 1.0,
      text: '',
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, newRedact]);
    setSelectedTextInfo(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleTextLayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const span = target.closest('span');

    if (activeTool === 'edit_content') {
      if (span && span.textContent?.trim()) {
        e.stopPropagation();
        if (!overlayRef.current) return;
        const overlayRect = overlayRef.current.getBoundingClientRect();
        const spanRect = span.getBoundingClientRect();

        const pctX = Math.max(0, Math.min(95, ((spanRect.left - overlayRect.left) / overlayRect.width) * 100));
        const pctY = Math.max(0, Math.min(95, ((spanRect.top - overlayRect.top) / overlayRect.height) * 100));
        const pctW = Math.max(6, Math.min(100 - pctX, (spanRect.width / overlayRect.width) * 100 + 2));
        const pctH = Math.max(3.5, Math.min(100 - pctY, (spanRect.height / overlayRect.height) * 100 + 1));

        const computedStyle = window.getComputedStyle(span);
        const computedFontSize = parseInt(computedStyle.fontSize, 10) || 14;

        const newText: Annotation = {
          id: `text_${Date.now()}`,
          pageIndex: currentPage - 1,
          type: 'text',
          x: pctX,
          y: pctY,
          width: pctW,
          height: pctH,
          color: '#0f172a',
          backgroundColor: '#ffffff',
          borderStyle: 'dashed',
          strokeWidth: 1,
          opacity: 1.0,
          fontSize: computedFontSize,
          text: span.textContent.trim(),
          createdAt: new Date().toISOString(),
        };

        commitAnnotations([...docModel.annotations, newText]);
        setSelectedAnnotationId(newText.id);
        setEditingTextId(newText.id);
        setActiveTool('select');
        setRightTab('properties');
        return;
      } else {
        // Clicked empty space in edit_content mode
        deselectAllAndSave();
        return;
      }
    }

    if (activeTool === 'select') {
      // In select mode, clicking empty space on the text layer or page deselects active object
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        deselectAllAndSave();
      }
    }
  };

  // Instant 1-click addition of tools at center of viewport
  const insertToolAtCenter = (toolType: ActiveTool) => {
    const defaultX = 34;
    const defaultY = 32;

    if (toolType === 'text') {
      const newText: Annotation = {
        id: `text_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'text',
        x: defaultX,
        y: defaultY,
        width: 32,
        height: 10,
        color: toolColor === '#f59e0b' ? '#0f172a' : toolColor,
        strokeWidth: 1,
        opacity: 1.0,
        fontSize: toolFontSize || 14,
        fontWeight: toolFontWeight,
        fontStyle: toolFontStyle,
        text: 'Type text here...',
        backgroundColor: '#ffffff',
        borderStyle: 'dashed',
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newText]);
      setSelectedAnnotationId(newText.id);
      setEditingTextId(newText.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    if (toolType === 'callout') {
      const newCallout: Annotation = {
        id: `callout_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'callout',
        x: defaultX,
        y: defaultY,
        width: 34,
        height: 12,
        color: '#1d4ed8',
        backgroundColor: '#eff6ff',
        strokeWidth: 2,
        opacity: 1.0,
        fontSize: 13,
        fontWeight: 'bold',
        text: '📌 Review note / Check figure',
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newCallout]);
      setSelectedAnnotationId(newCallout.id);
      setEditingTextId(newCallout.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    if (toolType === 'date') {
      const today = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const newDate: Annotation = {
        id: `date_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'date',
        x: defaultX,
        y: defaultY,
        width: 24,
        height: 6,
        color: '#1e293b',
        backgroundColor: '#f1f5f9',
        strokeWidth: 1,
        opacity: 1.0,
        fontSize: 12,
        fontWeight: 'bold',
        text: `📅 ${today}`,
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newDate]);
      setSelectedAnnotationId(newDate.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    if (toolType === 'sticky') {
      const newSticky: Annotation = {
        id: `sticky_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'sticky',
        x: defaultX,
        y: defaultY,
        width: 26,
        height: 16,
        color: '#854d0e',
        strokeWidth: 1,
        opacity: 0.95,
        text: 'Review comment: ',
        author: 'Reviewer',
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newSticky]);
      setSelectedAnnotationId(newSticky.id);
      setEditingTextId(newSticky.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    if (toolType === 'erase_overlay' || toolType === 'blackout') {
      const isBlackout = toolType === 'blackout';
      const newRedact: Annotation = {
        id: `redact_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: toolType,
        x: defaultX,
        y: defaultY,
        width: 28,
        height: 6,
        color: isBlackout ? '#000000' : '#ffffff',
        strokeWidth: 1,
        opacity: 1.0,
        text: isBlackout ? '' : 'REDACTED',
        fontSize: 12,
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newRedact]);
      setSelectedAnnotationId(newRedact.id);
      setActiveTool('select');
      return;
    }
  };

  // Start dragging an annotation
  const startDragAnnotation = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    setSelectedAnnotationId(ann.id);
    setIsDraggingAnn(true);
    const { pctX, pctY } = getRelativeCoords(e);
    setDragOffset({
      x: pctX - ann.x,
      y: pctY - ann.y,
    });
  };

  // Start resizing an annotation from corner handle
  const startResizeAnnotation = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedAnnotationId(ann.id);
    setIsResizingAnn(true);
    const { pctX, pctY } = getRelativeCoords(e);
    setResizeStart({
      pctX,
      pctY,
      origWidth: ann.width,
      origHeight: ann.height,
    });
  };

  // Global mouse handlers for smooth drag & resize across windows
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!overlayRef.current) return;
      const { pctX, pctY } = getRelativeCoords(e);

      if (isDraggingAnn && selectedAnnotationId) {
        const updated = docModel.annotations.map((a) => {
          if (a.id === selectedAnnotationId) {
            return {
              ...a,
              x: Math.max(0, Math.min(100 - a.width, pctX - dragOffset.x)),
              y: Math.max(0, Math.min(100 - a.height, pctY - dragOffset.y)),
            };
          }
          return a;
        });
        onUpdateDocument({ ...docModel, annotations: updated });
        return;
      }

      if (isResizingAnn && selectedAnnotationId && resizeStart) {
        const deltaX = pctX - resizeStart.pctX;
        const deltaY = pctY - resizeStart.pctY;
        const updated = docModel.annotations.map((a) => {
          if (a.id === selectedAnnotationId) {
            return {
              ...a,
              width: Math.max(6, Math.min(100 - a.x, resizeStart.origWidth + deltaX)),
              height: Math.max(3, Math.min(100 - a.y, resizeStart.origHeight + deltaY)),
            };
          }
          return a;
        });
        onUpdateDocument({ ...docModel, annotations: updated });
        return;
      }

      if (isDrawing && activeTool === 'draw') {
        setTempPoints((prev) => [...prev, { x: pctX, y: pctY }]);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingAnn) {
        setIsDraggingAnn(false);
        commitAnnotations(docModel.annotations);
      }
      if (isResizingAnn) {
        setIsResizingAnn(false);
        setResizeStart(null);
        commitAnnotations(docModel.annotations);
      }
    };

    if (isDraggingAnn || isResizingAnn) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingAnn, isResizingAnn, selectedAnnotationId, dragOffset, resizeStart, docModel.annotations]);

  // Canvas Mouse Interaction for Annotations
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    // If clicking on empty canvas overlay directly
    if (e.target === overlayRef.current) {
      deselectAllAndSave();
      if (activeTool === 'select') {
        return;
      }
    }

    const { pctX, pctY } = getRelativeCoords(e);

    // 1. TEXT TOOL: Drop an inline editable text box immediately at click!
    if (activeTool === 'text') {
      const newTextAnn: Annotation = {
        id: `text_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'text',
        x: Math.min(pctX, 75),
        y: Math.min(pctY, 92),
        width: 32,
        height: 10,
        color: toolColor === '#f59e0b' ? '#0f172a' : toolColor,
        strokeWidth: 1,
        opacity: 1.0,
        fontSize: toolFontSize || 14,
        fontWeight: toolFontWeight,
        fontStyle: toolFontStyle,
        text: 'Type text here...',
        backgroundColor: '#ffffff',
        borderStyle: 'dashed',
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newTextAnn]);
      setSelectedAnnotationId(newTextAnn.id);
      setEditingTextId(newTextAnn.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    // 2. CALLOUT TOOL: Drop callout with pointer notch
    if (activeTool === 'callout') {
      const newCallout: Annotation = {
        id: `callout_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'callout',
        x: Math.min(pctX, 70),
        y: Math.min(pctY, 85),
        width: 34,
        height: 12,
        color: '#1d4ed8',
        backgroundColor: '#eff6ff',
        strokeWidth: 2,
        opacity: 1.0,
        fontSize: 13,
        fontWeight: 'bold',
        text: '📌 Review note / Check section',
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newCallout]);
      setSelectedAnnotationId(newCallout.id);
      setEditingTextId(newCallout.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    // 3. DATE STAMP TOOL
    if (activeTool === 'date') {
      const today = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const newDateAnn: Annotation = {
        id: `date_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'date',
        x: Math.min(pctX, 80),
        y: Math.min(pctY, 95),
        width: 24,
        height: 6,
        color: '#1e293b',
        backgroundColor: '#f1f5f9',
        strokeWidth: 1,
        opacity: 1.0,
        fontSize: 12,
        fontWeight: 'bold',
        text: `📅 ${today}`,
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newDateAnn]);
      setSelectedAnnotationId(newDateAnn.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    // 4. STICKY NOTE: Drop an expandable sticky comment card immediately!
    if (activeTool === 'sticky') {
      const newSticky: Annotation = {
        id: `sticky_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: 'sticky',
        x: Math.min(pctX, 75),
        y: Math.min(pctY, 80),
        width: 26,
        height: 16,
        color: '#854d0e',
        strokeWidth: 1,
        opacity: 0.95,
        text: 'Review note: ',
        author: 'Reviewer',
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newSticky]);
      setSelectedAnnotationId(newSticky.id);
      setEditingTextId(newSticky.id);
      setActiveTool('select');
      setRightTab('properties');
      return;
    }

    // 5. WHITEOUT & REDACTION: Drop instant redaction box
    if (activeTool === 'erase_overlay' || activeTool === 'blackout') {
      const isBlackout = activeTool === 'blackout';
      const newRedact: Annotation = {
        id: `redact_${Date.now()}`,
        pageIndex: currentPage - 1,
        type: activeTool,
        x: Math.min(pctX, 70),
        y: Math.min(pctY, 95),
        width: 28,
        height: 6,
        color: isBlackout ? '#000000' : '#ffffff',
        strokeWidth: 1,
        opacity: 1.0,
        text: isBlackout ? '' : 'REDACTED',
        fontSize: 12,
        createdAt: new Date().toISOString(),
      };
      commitAnnotations([...docModel.annotations, newRedact]);
      setSelectedAnnotationId(newRedact.id);
      setActiveTool('select');
      return;
    }

    // 6. DRAWING / SHAPES: Start drag drawing
    setIsDrawing(true);
    setDrawStart({ pctX, pctY });

    if (activeTool === 'draw') {
      setTempPoints([{ x: pctX, y: pctY }]);
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    // If drawing freehand or dragging shape
    if (!isDrawing) return;
    const { pctX, pctY } = getRelativeCoords(e);

    if (activeTool === 'draw') {
      setTempPoints((prev) => [...prev, { x: pctX, y: pctY }]);
    }
  };

  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) {
      setIsDrawing(false);
      return;
    }

    const { pctX, pctY } = getRelativeCoords(e);
    const minX = Math.min(drawStart.pctX, pctX);
    const minY = Math.min(drawStart.pctY, pctY);
    const width = Math.max(Math.abs(pctX - drawStart.pctX), 4);
    const height = Math.max(Math.abs(pctY - drawStart.pctY), 3);

    const baseAnn: Annotation = {
      id: `ann_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: activeTool,
      x: minX,
      y: minY,
      width,
      height,
      color: toolColor,
      strokeWidth: toolStrokeWidth,
      opacity: activeTool === 'highlight' ? 0.35 : 1.0,
      createdAt: new Date().toISOString(),
    };

    if (activeTool === 'highlight') {
      commitAnnotations([...docModel.annotations, baseAnn]);
    } else if (activeTool === 'underline' || activeTool === 'strikethrough') {
      commitAnnotations([...docModel.annotations, { ...baseAnn, height: 1.5 }]);
    } else if (activeTool === 'rectangle' || activeTool === 'circle') {
      commitAnnotations([...docModel.annotations, baseAnn]);
    } else if (activeTool === 'line' || activeTool === 'arrow') {
      commitAnnotations([...docModel.annotations, { ...baseAnn, height: Math.max(height, 2) }]);
    } else if (activeTool === 'draw' && tempPoints.length > 1) {
      commitAnnotations([
        ...docModel.annotations,
        {
          ...baseAnn,
          points: tempPoints,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ]);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setTempPoints([]);
    setSelectedAnnotationId(baseAnn.id);
    setActiveTool('select');
  };

  // Signature placement
  const handleSignatureSaved = (dataUrl: string) => {
    const signatureAnn: Annotation = {
      id: `sig_${Date.now()}`,
      pageIndex: currentPage - 1,
      type: 'signature',
      x: 35,
      y: 50, // Land directly in typical signature block
      width: 32,
      height: 14,
      color: '#0f172a',
      strokeWidth: 2,
      opacity: 1.0,
      imageDataUrl: dataUrl,
      createdAt: new Date().toISOString(),
    };
    commitAnnotations([...docModel.annotations, signatureAnn]);
    setSelectedAnnotationId(signatureAnn.id);
    setActiveTool('select');
  };

  // AI Assistant Task Handler
  const runAiTask = async (task: string, query?: string) => {
    try {
      setAiLoading(true);
      const userMsg = query || `Run ${task} on this document`;
      setAiChatMessages((prev) => [
        ...prev,
        {
          role: 'user',
          text: userMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: extractedFullText || docModel.name,
          task,
          query,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAiChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.result,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (e: any) {
      setAiChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Error: ${e.message || 'AI request failed.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAiLoading(false);
      setAiPrompt('');
    }
  };

  const handleAiSend = () => {
    if (!aiPrompt.trim() || aiLoading) return;
    runAiTask('question', aiPrompt);
  };

  // Active annotations on current page
  const currentPageAnnotations = docModel.annotations.filter((a) => a.pageIndex === currentPage - 1);
  const selectedAnnotation = docModel.annotations.find((a) => a.id === selectedAnnotationId);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] bg-slate-100 overflow-hidden select-none">
      {/* 1. EXPANDED WORKSPACE TOOLBAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 z-20 gap-2 shrink-0 overflow-x-auto">
        {/* Left: Document info & Navigation */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 font-medium text-xs text-slate-800 truncate max-w-[180px]">
            <span className="truncate">{docModel.name}</span>
            <span className="text-slate-400 font-mono text-[11px]">({formatBytes(docModel.size)})</span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Page Paging */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous Page"
              className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-600 font-mono tabular-nums px-1">
              {currentPage} / {docModel.pageCount}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(docModel.pageCount, p + 1))}
              disabled={currentPage >= docModel.pageCount}
              aria-label="Next Page"
              className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.5, z - 0.25))}
              aria-label="Zoom Out"
              className="p-1 rounded text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-slate-700 w-10 text-center text-xs tabular-nums">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.25))}
              aria-label="Zoom In"
              className="p-1 rounded text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Full Paid-Grade Annotation & Editing Toolset */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
          {[
            { id: 'select', label: 'Select & Move Tool', icon: Sliders },
            { id: 'edit_content', label: 'Edit PDF Text in Document (Click any text on page)', icon: Edit3 },
            { id: 'text', label: 'Add Text Box', icon: Type },
            { id: 'callout', label: 'Callout Note', icon: MessageSquare },
            { id: 'date', label: 'Date Stamp', icon: Calendar },
            { id: 'sticky', label: 'Sticky Note / Comment', icon: StickyNote },
            { id: 'highlight', label: 'Highlight Text', icon: Highlighter },
            { id: 'underline', label: 'Underline', icon: Underline },
            { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough },
            { id: 'draw', label: 'Freehand Pen', icon: PenTool },
            { id: 'arrow', label: 'Directional Arrow', icon: ArrowRight },
            { id: 'line', label: 'Straight Line', icon: Minus },
            { id: 'rectangle', label: 'Rectangle Shape', icon: Square },
            { id: 'circle', label: 'Circle Shape', icon: Circle },
            { id: 'erase_overlay', label: 'Whiteout / Eraser', icon: Eraser },
            { id: 'blackout', label: 'Blackout Redaction', icon: ShieldAlert },
          ].map((t) => {
            const IconComp = t.icon;
            const isAct = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTool(t.id as ActiveTool);
                  if (t.id === 'highlight' && toolColor === '#0f172a') setToolColor('#f59e0b');
                  if (t.id === 'text' || t.id === 'sticky' || t.id === 'callout' || t.id === 'date' || t.id === 'edit_content') {
                    setRightTab('properties');
                  }
                }}
                title={t.label}
                aria-label={t.label}
                className={`p-1.5 rounded-md transition-all ${
                  isAct
                    ? 'bg-white text-indigo-700 font-semibold shadow-xs ring-1 ring-indigo-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <IconComp className="w-4 h-4" />
              </button>
            );
          })}

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* Stamp Picker Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStampPicker(!showStampPicker)}
              title="Add Business Stamp"
              aria-label="Add Business Stamp"
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200/60 rounded-md font-medium transition-colors"
            >
              <Stamp className="w-3.5 h-3.5 text-indigo-600" />
              <span>Stamp</span>
            </button>

            {showStampPicker && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 divide-y divide-slate-100">
                <div className="py-1">
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Approval</div>
                  {['APPROVED', 'RECEIVED', 'FINAL', 'COMPLETED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleAddStamp(st)}
                      className="w-full text-left px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded flex items-center justify-between"
                    >
                      <span>{st}</span>
                      <Check className="w-3 h-3 text-emerald-600" />
                    </button>
                  ))}
                </div>
                <div className="py-1">
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Restricted</div>
                  {['CONFIDENTIAL', 'VOID', 'URGENT', 'REJECTED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleAddStamp(st)}
                      className="w-full text-left px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded flex items-center justify-between"
                    >
                      <span>{st}</span>
                      <CloseIcon className="w-3 h-3 text-rose-600" />
                    </button>
                  ))}
                </div>
                <div className="py-1">
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Signatures & Review</div>
                  {['SIGN HERE', 'INITIAL HERE', 'DRAFT', 'EXPIRED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleAddStamp(st)}
                      className="w-full text-left px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Check & Cross stamp buttons */}
          <button
            onClick={() => handleAddQuickMark('check')}
            title="Add Checkmark Stamp"
            aria-label="Add Checkmark Stamp"
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAddQuickMark('cross')}
            title="Add Cross (X) Stamp"
            aria-label="Add Cross Stamp"
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
          >
            <CloseIcon className="w-4 h-4" />
          </button>

          {/* Signature Tool */}
          <button
            onClick={() => setIsSignatureModalOpen(true)}
            title="Create Digital Signature"
            aria-label="Create Digital Signature"
            className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md font-medium transition-colors"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>Sign</span>
          </button>

          {/* Insert Image Tool */}
          <button
            onClick={handleInsertImageClick}
            title="Insert Image / Logo onto Page"
            aria-label="Insert Image"
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200/60 rounded-md font-medium transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
            <span>Image</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleImageFileSelected}
            className="hidden"
          />

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* Watermark & Page Numbers (Paid Tools) */}
          <button
            onClick={handleApplyWatermark}
            title="Add Watermark Across All Pages"
            aria-label="Add Watermark"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded"
          >
            <Droplets className="w-4 h-4" />
          </button>
          <button
            onClick={handleApplyPageNumbers}
            title="Add Bates / Page Numbering"
            aria-label="Add Page Numbers"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded"
          >
            <Hash className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Color Selector, Undo/Redo & Download */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Color Palette */}
          <div className="flex items-center gap-1">
            {['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#0f172a'].map((c) => (
              <button
                key={c}
                onClick={() => setToolColor(c)}
                className={`w-4 h-4 rounded-full border transition-transform ${
                  toolColor === c ? 'scale-125 border-slate-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo"
            aria-label="Undo annotation"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= annotationHistory.length - 1}
            title="Redo"
            aria-label="Redo annotation"
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save & Download</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE VIEWPORT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR: THUMBNAILS & PAGE ACTIONS */}
        <div className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Pages ({docModel.pageCount})</span>
            <div className="flex items-center gap-1 text-[11px] font-normal text-slate-500">
              <button
                onClick={() => handleRotateCurrentPage(90)}
                title="Rotate Page 90° Clockwise"
                aria-label="Rotate Page 90°"
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDuplicateCurrentPage}
                title="Duplicate Current Page"
                aria-label="Duplicate Page"
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteCurrentPage}
                title="Delete Current Page"
                aria-label="Delete Page"
                className="p-1 hover:bg-rose-50 rounded text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search bar inside thumbnails */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Find in document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            {searchMatches.length > 0 && (
              <div className="mt-1 text-[10px] text-indigo-600 font-medium">
                Found on page(s): {searchMatches.join(', ')}
              </div>
            )}
          </div>

          {/* Thumbnail list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {Array.from({ length: docModel.pageCount }, (_, idx) => {
              const pNum = idx + 1;
              const isSelected = pNum === currentPage;
              const hasMatch = searchMatches.includes(pNum);

              return (
                <div
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  className={`group relative p-2 rounded-lg cursor-pointer border transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 shadow-xs ring-1 ring-slate-900'
                      : hasMatch
                      ? 'border-indigo-400 bg-indigo-50/40'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-mono font-medium">Page {pNum}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPage(pNum);
                          handleMovePage('up');
                        }}
                        disabled={pNum === 1}
                        className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentPage(pNum);
                          handleMovePage('down');
                        }}
                        disabled={pNum === docModel.pageCount}
                        className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail canvas preview */}
                  <div className="w-full aspect-[1/1.3] bg-slate-100 rounded border border-slate-200 overflow-hidden flex items-center justify-center">
                    {thumbnails[pNum] ? (
                      <img
                        src={thumbnails[pNum]}
                        alt={`Page ${pNum}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 font-mono">Rendering...</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER VIEWPORT: CANVAS + INTERACTIVE WYSIWYG ANNOTATION LAYER */}
        <div
          className="flex-1 overflow-auto p-8 flex flex-col items-center justify-start bg-slate-200/60 relative cursor-default"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              deselectAllAndSave();
            }
          }}
        >
          {/* Active Tool Helper / Fast Placement Banner */}
          {activeTool !== 'select' && (
            <div className="sticky top-0 mb-4 z-40 flex items-center gap-3 bg-slate-900/95 text-white px-4 py-2 rounded-full shadow-xl text-xs backdrop-blur-sm border border-slate-700/50 animate-in fade-in slide-in-from-top-2">
              <span className="font-medium flex items-center gap-1.5">
                {activeTool === 'edit_content' && <>✏️ <span className="font-semibold text-indigo-300">Edit PDF Text:</span> Click any text line or word on the page to edit it directly, or drag to replace</>}
                {activeTool === 'text' && <>🔤 <span className="font-semibold text-amber-300">Text Box:</span> Click anywhere on page to place, or</>}
                {activeTool === 'callout' && <>💬 <span className="font-semibold text-blue-300">Callout Note:</span> Click on page to place pointer, or</>}
                {activeTool === 'date' && <>📅 <span className="font-semibold text-emerald-300">Date Stamp:</span> Click on page to place today's date, or</>}
                {activeTool === 'sticky' && <>📝 <span className="font-semibold text-amber-300">Sticky Note:</span> Click on page to place comment, or</>}
                {activeTool === 'highlight' && <>🖍️ <span className="font-semibold text-yellow-300">Highlighter:</span> Drag over text or area to highlight</>}
                {activeTool === 'draw' && <>✏️ <span className="font-semibold text-indigo-300">Pen:</span> Click and drag to sketch or mark</>}
                {activeTool === 'rectangle' && <>⬛ <span className="font-semibold text-indigo-300">Rectangle:</span> Click and drag diagonally to draw shape</>}
                {activeTool === 'circle' && <>⭕ <span className="font-semibold text-indigo-300">Circle:</span> Click and drag diagonally to draw ellipse</>}
                {activeTool === 'arrow' && <>➡️ <span className="font-semibold text-indigo-300">Arrow:</span> Click and drag to draw directional arrow</>}
                {activeTool === 'line' && <>➖ <span className="font-semibold text-indigo-300">Line:</span> Click and drag to draw straight line</>}
                {activeTool === 'erase_overlay' && <>⬜ <span className="font-semibold text-slate-300">Whiteout:</span> Click on page or drag to cover content, or</>}
                {activeTool === 'blackout' && <>⬛ <span className="font-semibold text-rose-300">Redaction:</span> Click on page or drag to blackout, or</>}
              </span>
              {['text', 'callout', 'date', 'sticky', 'erase_overlay', 'blackout'].includes(activeTool) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    insertToolAtCenter(activeTool);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-full text-[11px] shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Insert at Center</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTool('select');
                  deselectAllAndSave();
                }}
                className="text-slate-400 hover:text-white text-[11px] underline ml-1 cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          <div
            className="relative shadow-xl rounded-sm bg-white shrink-0 select-text"
            style={{
              width: renderDims.width,
              height: renderDims.height,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                deselectAllAndSave();
              }
            }}
            onMouseUp={handleCheckTextSelection}
          >
            {/* The PDF Page Canvas */}
            <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />

            {/* Native PDF.js Text Layer for text selection & content editing */}
            <div
              ref={textLayerRef}
              onClick={handleTextLayerClick}
              onMouseDown={(e) => {
                if (activeTool === 'select' && (selectedAnnotationId || editingTextId)) {
                  deselectAllAndSave();
                }
              }}
              className={`textLayer absolute inset-0 select-text ${
                activeTool === 'edit_content' ? 'edit-content-mode' : ''
              } ${
                activeTool === 'select' || activeTool === 'edit_content'
                  ? 'pointer-events-auto'
                  : 'pointer-events-none'
              }`}
            />

            {/* Floating Contextual Action Bar for Selected Text */}
            {selectedTextInfo && (
              <div
                style={{
                  top: selectedTextInfo.topPx,
                  left: selectedTextInfo.leftPx,
                }}
                className="absolute z-50 flex items-center gap-1 bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-2xl border border-slate-700 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 select-none"
              >
                {copyFeedback ? (
                  <span className="text-emerald-400 font-semibold px-2 py-0.5 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Copied to Clipboard!
                  </span>
                ) : (
                  <>
                    <button
                      onClick={handleCopySelectedText}
                      title="Copy text (Ctrl+C)"
                      className="flex items-center gap-1 px-2 py-1 hover:bg-slate-800 rounded text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <div className="w-px h-3.5 bg-slate-700" />
                    <button
                      onClick={handleHighlightSelection}
                      title="Highlight selected text"
                      className="flex items-center gap-1 px-2 py-1 hover:bg-amber-500/20 text-amber-300 rounded transition-colors cursor-pointer"
                    >
                      <Highlighter className="w-3 h-3" />
                      <span>Highlight</span>
                    </button>
                    <button
                      onClick={handleUnderlineSelection}
                      title="Underline text"
                      className="flex items-center gap-1 px-1.5 py-1 hover:bg-blue-500/20 text-blue-300 rounded transition-colors cursor-pointer"
                    >
                      <Underline className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleStrikethroughSelection}
                      title="Strikethrough text"
                      className="flex items-center gap-1 px-1.5 py-1 hover:bg-rose-500/20 text-rose-300 rounded transition-colors cursor-pointer"
                    >
                      <Strikethrough className="w-3 h-3" />
                    </button>
                    <div className="w-px h-3.5 bg-slate-700" />
                    <button
                      onClick={handleEditReplaceSelection}
                      title="Edit / Replace this text directly in document"
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded transition-colors cursor-pointer shadow-xs"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Text</span>
                    </button>
                    <button
                      onClick={handleRedactSelection}
                      title="Redact / Blackout"
                      className="flex items-center gap-1 px-1.5 py-1 hover:bg-rose-900/40 text-rose-400 rounded transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setSelectedTextInfo(null)}
                      title="Close"
                      className="text-slate-400 hover:text-slate-200 p-0.5 ml-0.5 cursor-pointer"
                    >
                      <CloseIcon className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Interactive Vector Annotation Layer */}
            <div
              ref={overlayRef}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
              className={`absolute inset-0 z-20 ${
                activeTool === 'select' || activeTool === 'edit_content'
                  ? 'pointer-events-none'
                  : 'pointer-events-auto'
              } ${
                activeTool === 'select'
                  ? 'cursor-default'
                  : activeTool === 'edit_content'
                  ? 'cursor-pointer'
                  : activeTool === 'draw'
                  ? 'cursor-crosshair'
                  : activeTool === 'text'
                  ? 'cursor-text'
                  : 'cursor-crosshair'
              }`}
            >
              {/* Existing annotations for this page */}
              {currentPageAnnotations.map((ann) => {
                const isSelected = ann.id === selectedAnnotationId;
                const isEditingText = ann.id === editingTextId;

                // 1. INLINE EDITABLE TEXT BOX
                if (ann.type === 'text') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setEditingTextId(ann.id);
                      }}
                      className={`absolute pointer-events-auto group transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 bg-white shadow-md z-30'
                          : 'hover:ring-1 hover:ring-indigo-300 z-10'
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        backgroundColor: ann.backgroundColor || 'transparent',
                      }}
                    >
                      {/* Selection handle bar */}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startDragAnnotation(e, ann)}
                          className="absolute -top-6 left-0 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-t flex items-center gap-1.5 cursor-move shadow-xs select-none"
                        >
                          <Move className="w-3 h-3" />
                          <span>Text Box</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deselectAllAndSave();
                            }}
                            title="Done Editing (Deselect)"
                            className="flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[9px] cursor-pointer ml-0.5 shadow-xs transition-colors"
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Done</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateSelectedAnnotation();
                            }}
                            title="Duplicate"
                            className="hover:text-indigo-200 ml-0.5"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSelectedAnnotation();
                            }}
                            title="Delete"
                            className="hover:text-rose-200 ml-0.5"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Content editor */}
                      {isEditingText ? (
                        <textarea
                          autoFocus
                          onFocus={(e) => {
                            if (
                              ann.text === 'Type text here...' ||
                              ann.text === 'Click to edit text' ||
                              ann.text === 'Type text here'
                            ) {
                              e.target.select();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              deselectAllAndSave();
                            }
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              deselectAllAndSave();
                            }
                          }}
                          rows={Math.max(2, (ann.text || '').split('\n').length)}
                          value={ann.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = docModel.annotations.map((a) =>
                              a.id === ann.id ? { ...a, text: val } : a
                            );
                            onUpdateDocument({ ...docModel, annotations: updated });
                          }}
                          onBlur={() => {
                            setEditingTextId(null);
                            commitAnnotations(docModel.annotations);
                          }}
                          className="w-full p-1 bg-white border border-indigo-500 rounded focus:outline-none resize-none shadow-xs"
                          style={{
                            fontSize: `${ann.fontSize || 14}px`,
                            fontWeight: ann.fontWeight || 'normal',
                            fontStyle: ann.fontStyle || 'normal',
                            fontFamily:
                              ann.fontFamily === 'serif'
                                ? 'Georgia, serif'
                                : ann.fontFamily === 'mono'
                                ? 'JetBrains Mono, monospace'
                                : 'Plus Jakarta Sans, sans-serif',
                            textAlign: ann.textAlign || 'left',
                            color: ann.color,
                          }}
                        />
                      ) : (
                        <div
                          className="p-1 break-words whitespace-pre-wrap cursor-pointer"
                          style={{
                            fontSize: `${ann.fontSize || 14}px`,
                            fontWeight: ann.fontWeight || 'normal',
                            fontStyle: ann.fontStyle || 'normal',
                            fontFamily:
                              ann.fontFamily === 'serif'
                                ? 'Georgia, serif'
                                : ann.fontFamily === 'mono'
                                ? 'JetBrains Mono, monospace'
                                : 'Plus Jakarta Sans, sans-serif',
                            textAlign: ann.textAlign || 'left',
                            color: ann.color,
                          }}
                        >
                          {ann.text || <span className="text-slate-300 italic">Empty text</span>}
                        </div>
                      )}

                      {/* Corner Resize Handle */}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize text box"
                        />
                      )}
                    </div>
                  );
                }

                // 2. CALLOUT NOTE WITH POINTER
                if (ann.type === 'callout') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setEditingTextId(ann.id);
                      }}
                      className={`absolute pointer-events-auto p-2.5 rounded-lg shadow-md border z-20 transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 border-indigo-500 bg-blue-50/95'
                          : 'border-blue-300 bg-blue-50/90 hover:border-blue-400'
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                      }}
                    >
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startDragAnnotation(e, ann)}
                          className="absolute -top-7 left-0 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-t flex items-center gap-1.5 cursor-move shadow-xs select-none"
                        >
                          <Move className="w-3 h-3" />
                          <span>Callout</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deselectAllAndSave();
                            }}
                            title="Done (Deselect)"
                            className="flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-[9px] cursor-pointer ml-0.5 shadow-xs transition-colors"
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Done</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateSelectedAnnotation();
                            }}
                            className="hover:text-blue-200 ml-0.5"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSelectedAnnotation();
                            }}
                            className="hover:text-rose-200 ml-0.5"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Pointer Notch */}
                      <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500" />

                      {isEditingText ? (
                        <textarea
                          autoFocus
                          rows={Math.max(2, (ann.text || '').split('\n').length)}
                          value={ann.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = docModel.annotations.map((a) =>
                              a.id === ann.id ? { ...a, text: val } : a
                            );
                            onUpdateDocument({ ...docModel, annotations: updated });
                          }}
                          onBlur={() => {
                            setEditingTextId(null);
                            commitAnnotations(docModel.annotations);
                          }}
                          className="w-full p-1 bg-white border border-blue-400 rounded focus:outline-none resize-none font-sans text-xs text-blue-950 font-medium"
                        />
                      ) : (
                        <div className="text-xs text-blue-950 font-medium whitespace-pre-wrap break-words cursor-pointer">
                          {ann.text || '📌 Review Note'}
                        </div>
                      )}

                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize callout"
                        />
                      )}
                    </div>
                  );
                }

                // 3. DATE STAMP BADGE
                if (ann.type === 'date') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      className={`absolute pointer-events-auto px-2.5 py-1 bg-slate-100/90 border border-slate-300 rounded-md shadow-xs text-slate-800 text-xs font-semibold flex items-center justify-between gap-1 z-20 cursor-move ${
                        isSelected ? 'ring-2 ring-indigo-600 border-indigo-500 bg-white' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                      }}
                    >
                      <div
                        onMouseDown={(e) => startDragAnnotation(e, ann)}
                        className="flex-1 flex items-center gap-1 cursor-move truncate"
                      >
                        <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{ann.text || 'Date'}</span>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSelectedAnnotation();
                            }}
                            className="text-slate-400 hover:text-rose-600 p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize"
                        />
                      )}
                    </div>
                  );
                }

                // 4. STICKY NOTE / COMMENT
                if (ann.type === 'sticky') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      className={`absolute pointer-events-auto p-2 bg-amber-100 border border-amber-300 rounded-lg shadow-md text-amber-950 text-xs z-20 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                      }}
                    >
                      <div
                        onMouseDown={(e) => startDragAnnotation(e, ann)}
                        className="flex items-center justify-between pb-1 border-b border-amber-200 cursor-move select-none"
                      >
                        <span className="font-bold text-[10px] text-amber-800 flex items-center gap-1">
                          <StickyNote className="w-3 h-3" /> {ann.author || 'Note'}
                        </span>
                        {isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSelectedAnnotation();
                            }}
                            className="text-amber-700 hover:text-rose-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={ann.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = docModel.annotations.map((a) =>
                            a.id === ann.id ? { ...a, text: val } : a
                          );
                          onUpdateDocument({ ...docModel, annotations: updated });
                        }}
                        onBlur={() => commitAnnotations(docModel.annotations)}
                        className="w-full bg-transparent focus:outline-none resize-none pt-1 leading-tight text-xs"
                      />
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize note"
                        />
                      )}
                    </div>
                  );
                }

                // 5. STAMP (Approved, Confidential, Void, etc.)
                if (ann.type === 'stamp') {
                  const stampText = ann.stampType || 'APPROVED';
                  const isRed = stampText.includes('CONFIDENTIAL') || stampText.includes('VOID') || stampText.includes('REJECTED');
                  const isAmber = stampText.includes('DRAFT');
                  const isIndigo = stampText.includes('SIGN') || stampText.includes('INITIAL');

                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto cursor-move border-4 rounded-md p-1.5 flex items-center justify-center font-bold tracking-widest text-center shadow-xs select-none rotate-[-6deg] z-20 ${
                        isRed
                          ? 'border-rose-600 text-rose-600 bg-white/90'
                          : isAmber
                          ? 'border-amber-600 text-amber-600 bg-white/90'
                          : isIndigo
                          ? 'border-indigo-600 text-indigo-600 bg-white/90'
                          : 'border-emerald-600 text-emerald-600 bg-white/90'
                      } ${isSelected ? 'ring-2 ring-indigo-600' : ''}`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                      }}
                    >
                      <span className="text-xs sm:text-sm font-black border-2 border-current px-2 py-0.5 rounded-xs w-full block truncate">
                        {stampText}
                      </span>
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-slate-900 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize stamp"
                        />
                      )}
                    </div>
                  );
                }

                // 6. CHECK & CROSS MARKS
                if (ann.type === 'check' || ann.type === 'cross') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto cursor-move flex items-center justify-center rounded p-1 z-20 ${
                        isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/50' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                      }}
                    >
                      {ann.type === 'check' ? (
                        <Check className="w-full h-full text-emerald-600 stroke-[3]" />
                      ) : (
                        <CloseIcon className="w-full h-full text-rose-600 stroke-[3]" />
                      )}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize mark"
                        />
                      )}
                    </div>
                  );
                }

                // 7. WHITEOUT & BLACKOUT (REDACTION)
                if (ann.type === 'erase_overlay' || ann.type === 'blackout') {
                  const isBlackout = ann.type === 'blackout';
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto cursor-move border flex items-center justify-center p-1 text-xs z-20 ${
                        isBlackout
                          ? 'bg-black text-black border-black'
                          : 'bg-white text-slate-800 border-slate-300 border-dashed'
                      } ${isSelected ? 'ring-2 ring-indigo-600' : ''}`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                      }}
                    >
                      {!isBlackout && (
                        <input
                          type="text"
                          value={ann.text || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = docModel.annotations.map((a) =>
                              a.id === ann.id ? { ...a, text: val } : a
                            );
                            onUpdateDocument({ ...docModel, annotations: updated });
                          }}
                          placeholder="Redacted"
                          className="w-full text-center bg-transparent focus:outline-none text-xs font-mono"
                        />
                      )}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize redaction"
                        />
                      )}
                    </div>
                  );
                }

                // 6. DIRECTIONAL ARROW
                if (ann.type === 'arrow') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto cursor-move flex items-center z-10 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${Math.max(ann.height, 4)}%`,
                      }}
                    >
                      <div
                        className="flex-1 h-[2px]"
                        style={{ backgroundColor: ann.color, height: `${ann.strokeWidth || 2}px` }}
                      />
                      <ArrowRight
                        className="shrink-0 -ml-1"
                        style={{ color: ann.color, width: '16px', height: '16px' }}
                      />
                    </div>
                  );
                }

                // 7. STRAIGHT LINE
                if (ann.type === 'line') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto cursor-move flex items-center z-10 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${Math.max(ann.height, 3)}%`,
                      }}
                    >
                      <div
                        className="w-full"
                        style={{ backgroundColor: ann.color, height: `${ann.strokeWidth || 2}px` }}
                      />
                    </div>
                  );
                }

                // 8. HIGHLIGHT
                if (ann.type === 'highlight') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      className={`absolute pointer-events-auto cursor-pointer transition-all z-10 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                        backgroundColor: ann.color,
                        opacity: ann.opacity,
                        mixBlendMode: 'multiply',
                      }}
                    />
                  );
                }

                // 9. UNDERLINE & STRIKETHROUGH
                if (ann.type === 'underline' || ann.type === 'strikethrough') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      className={`absolute pointer-events-auto z-10 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.strokeWidth || 2}px`,
                        backgroundColor: ann.color,
                      }}
                    />
                  );
                }

                // 10. RECTANGLE
                if (ann.type === 'rectangle') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto cursor-move border z-10 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                        borderColor: ann.color,
                        borderWidth: `${ann.strokeWidth}px`,
                      }}
                    >
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize shape"
                        />
                      )}
                    </div>
                  );
                }

                // 11. CIRCLE
                if (ann.type === 'circle') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto cursor-move border rounded-full z-10 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                        borderColor: ann.color,
                        borderWidth: `${ann.strokeWidth}px`,
                      }}
                    >
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize circle"
                        />
                      )}
                    </div>
                  );
                }

                // 12. SIGNATURE & IMAGE PLACEMENT
                if ((ann.type === 'signature' || ann.type === 'image') && ann.imageDataUrl) {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                        setRightTab('properties');
                      }}
                      onMouseDown={(e) => startDragAnnotation(e, ann)}
                      className={`absolute pointer-events-auto group cursor-move z-20 ${
                        isSelected ? 'ring-2 ring-indigo-600' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                      }}
                    >
                      <img
                        src={ann.imageDataUrl}
                        alt="Asset"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                      {isSelected && (
                        <div
                          onMouseDown={(e) => startResizeAnnotation(e, ann)}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform z-40"
                          title="Drag to resize image/signature"
                        />
                      )}
                    </div>
                  );
                }

                // 13. FREEHAND DRAWING PATH
                if (ann.type === 'draw' && ann.points && ann.points.length > 1) {
                  const svgPath = ann.points.reduce(
                    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
                    ''
                  );
                  return (
                    <svg
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    >
                      <path
                        d={svgPath}
                        fill="none"
                        stroke={ann.color}
                        strokeWidth={ann.strokeWidth * 0.3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pointer-events-auto cursor-pointer"
                      />
                    </svg>
                  );
                }

                return null;
              })}

              {/* Temp drawing line during drag */}
              {isDrawing && activeTool === 'draw' && tempPoints.length > 1 && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none z-30"
                >
                  <path
                    d={tempPoints.reduce(
                      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
                      ''
                    )}
                    fill="none"
                    stroke={toolColor}
                    strokeWidth={toolStrokeWidth * 0.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: OBJECT PROPERTIES, METADATA & AI COPILOT */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0">
          {/* Segmented Tab Controls */}
          <div className="p-2 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full">
              <button
                onClick={() => setRightTab('properties')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
                  rightTab === 'properties'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Object
              </button>
              <button
                onClick={() => setRightTab('ai')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
                  rightTab === 'ai' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                AI Copilot
              </button>
              <button
                onClick={() => setRightTab('inspect')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
                  rightTab === 'inspect'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                Analyze
              </button>
            </div>
          </div>

          {/* TAB 1: OBJECT PROPERTIES */}
          {rightTab === 'properties' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {selectedAnnotation ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-semibold text-slate-900 capitalize flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      {selectedAnnotation.type.replace('_', ' ')} Properties
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          commitAnnotations(docModel.annotations);
                          setSelectedAnnotationId(null);
                          setEditingTextId(null);
                        }}
                        title="Done Editing & Deselect"
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors mr-1"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Done</span>
                      </button>
                      <button
                        onClick={duplicateSelectedAnnotation}
                        title="Duplicate (Ctrl+D)"
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={deleteSelectedAnnotation}
                        title="Delete (Del)"
                        className="p-1 hover:bg-rose-50 rounded text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Save confirmation banner */}
                  {saveSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-in fade-in slide-in-from-top-1 shadow-xs">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Changes saved to document successfully!</span>
                    </div>
                  )}

                  {/* Text Box & Callout Specific Typography Controls */}
                  {(selectedAnnotation.type === 'text' || selectedAnnotation.type === 'callout') && (
                    <div className="space-y-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                      <div className="font-medium text-slate-700">Typography & Style</div>

                      {/* Font Size & Weight */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] text-slate-500 mb-1">Size</label>
                          <select
                            value={selectedAnnotation.fontSize || 14}
                            onChange={(e) => {
                              const sz = parseInt(e.target.value, 10);
                              const updated = docModel.annotations.map((a) =>
                                a.id === selectedAnnotation.id ? { ...a, fontSize: sz } : a
                              );
                              commitAnnotations(updated);
                            }}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                          >
                            {[9, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((s) => (
                              <option key={s} value={s}>
                                {s} px
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Bold & Italic toggles */}
                        <div className="flex items-end gap-1">
                          <button
                            onClick={() => {
                              const newWeight: 'normal' | 'bold' = selectedAnnotation.fontWeight === 'bold' ? 'normal' : 'bold';
                              const updated = docModel.annotations.map((a) =>
                                a.id === selectedAnnotation.id ? { ...a, fontWeight: newWeight } : a
                              );
                              commitAnnotations(updated);
                            }}
                            className={`p-1.5 rounded border transition-colors ${
                              selectedAnnotation.fontWeight === 'bold'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const newStyle: 'normal' | 'italic' = selectedAnnotation.fontStyle === 'italic' ? 'normal' : 'italic';
                              const updated = docModel.annotations.map((a) =>
                                a.id === selectedAnnotation.id ? { ...a, fontStyle: newStyle } : a
                              );
                              commitAnnotations(updated);
                            }}
                            className={`p-1.5 rounded border transition-colors ${
                              selectedAnnotation.fontStyle === 'italic'
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <Italic className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Background Fill */}
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Background Fill</label>
                        <div className="flex items-center gap-1.5">
                          {[
                            { label: 'None', val: '' },
                            { label: 'White', val: '#ffffff' },
                            { label: 'Tint', val: '#f8fafc' },
                            { label: 'Yellow', val: '#fef08a' },
                            { label: 'Blue', val: '#eff6ff' },
                          ].map((bg) => (
                            <button
                              key={bg.label}
                              onClick={() => {
                                const updated = docModel.annotations.map((a) =>
                                  a.id === selectedAnnotation.id ? { ...a, backgroundColor: bg.val } : a
                                );
                                commitAnnotations(updated);
                              }}
                              className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                                (selectedAnnotation.backgroundColor || '') === bg.val
                                  ? 'border-indigo-600 bg-white font-medium text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {bg.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Direct Text Editor in Properties Panel */}
                  {selectedAnnotation.text !== undefined && (
                    <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                          <Type className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Edit Text Content</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Live preview</span>
                      </div>
                      <textarea
                        rows={3}
                        value={selectedAnnotation.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = docModel.annotations.map((a) =>
                            a.id === selectedAnnotation.id ? { ...a, text: val } : a
                          );
                          onUpdateDocument({ ...docModel, annotations: updated });
                        }}
                        onBlur={() => commitAnnotations(docModel.annotations)}
                        placeholder="Type text content here..."
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
                      />
                      {/* Save & Done Buttons for Text */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            commitAnnotations(docModel.annotations);
                            setSaveSuccess(true);
                            setTimeout(() => setSaveSuccess(false), 2500);
                          }}
                          className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Text</span>
                        </button>
                        <button
                          onClick={() => {
                            commitAnnotations(docModel.annotations);
                            setSelectedAnnotationId(null);
                            setEditingTextId(null);
                          }}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save & Done</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Color adjustment */}
                  <div>
                    <label className="block text-slate-500 mb-1 font-medium">Color</label>
                    <div className="flex items-center gap-2">
                      {['#0f172a', '#dc2626', '#16a34a', '#2563eb', '#8b5cf6', '#d97706'].map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            const updated = docModel.annotations.map((a) =>
                              a.id === selectedAnnotation.id ? { ...a, color: c } : a
                            );
                            commitAnnotations(updated);
                          }}
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                            selectedAnnotation.color === c ? 'scale-110 border-slate-900' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                          aria-label={`Select color ${c}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stroke Width */}
                  {selectedAnnotation.type !== 'text' && selectedAnnotation.type !== 'stamp' && selectedAnnotation.type !== 'date' && (
                    <div>
                      <div className="flex justify-between text-slate-500 mb-1">
                        <span>Line / Border Width</span>
                        <span className="font-mono">{selectedAnnotation.strokeWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={selectedAnnotation.strokeWidth}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          const updated = docModel.annotations.map((a) =>
                            a.id === selectedAnnotation.id ? { ...a, strokeWidth: val } : a
                          );
                          commitAnnotations(updated);
                        }}
                        className="w-full cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Opacity */}
                  <div>
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span>Opacity</span>
                      <span className="font-mono">{Math.round(selectedAnnotation.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={selectedAnnotation.opacity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const updated = docModel.annotations.map((a) =>
                          a.id === selectedAnnotation.id ? { ...a, opacity: val } : a
                        );
                        commitAnnotations(updated);
                      }}
                      className="w-full cursor-pointer"
                    />
                  </div>

                  {/* Width & Height Box Resizing */}
                  <div>
                    <div className="flex justify-between text-slate-500 mb-1">
                      <span>Box Width</span>
                      <span className="font-mono">{Math.round(selectedAnnotation.width)}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={selectedAnnotation.width}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const updated = docModel.annotations.map((a) =>
                          a.id === selectedAnnotation.id ? { ...a, width: val } : a
                        );
                        commitAnnotations(updated);
                      }}
                      className="w-full cursor-pointer"
                    />
                  </div>

                  {/* Object Window Save & Done Actions */}
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <button
                      onClick={() => {
                        commitAnnotations(docModel.annotations);
                        setSaveSuccess(true);
                        setTimeout(() => setSaveSuccess(false), 2500);
                      }}
                      className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Changes to Object</span>
                    </button>
                    <button
                      onClick={() => {
                        commitAnnotations(docModel.annotations);
                        setSelectedAnnotationId(null);
                        setEditingTextId(null);
                      }}
                      className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Done Editing (Deselect)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-center">
                    <Sliders className="w-5 h-5 mx-auto text-indigo-500" />
                    <p className="font-semibold text-slate-800 text-xs">Page {currentPage} Workspace</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Select any element on the document to edit its properties, or click a tool below to quickly add it:
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Quick Add to Page {currentPage}
                    </div>

                    <button
                      onClick={() => insertToolAtCenter('text')}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer group shadow-xs"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Type className="w-4 h-4 text-indigo-600" />
                        <span>Add Text Box</span>
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                    </button>

                    <button
                      onClick={() => insertToolAtCenter('callout')}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer group shadow-xs"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span>Add Callout Note</span>
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                    </button>

                    <button
                      onClick={() => insertToolAtCenter('date')}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer group shadow-xs"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>Add Today's Date</span>
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                    </button>

                    <button
                      onClick={() => insertToolAtCenter('sticky')}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer group shadow-xs"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <StickyNote className="w-4 h-4 text-amber-600" />
                        <span>Add Sticky Comment</span>
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    </button>

                    <button
                      onClick={() => insertToolAtCenter('erase_overlay')}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer group shadow-xs"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Eraser className="w-4 h-4 text-slate-600" />
                        <span>Add Whiteout Box</span>
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                    </button>

                    <button
                      onClick={() => insertToolAtCenter('blackout')}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer group shadow-xs"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>Add Redaction (Blackout)</span>
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI COPILOT */}
          {rightTab === 'ai' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Quick AI Action Pills */}
              <div className="p-3 border-b border-slate-100 flex flex-wrap gap-1.5 bg-slate-50/50">
                {[
                  { id: 'summarize', label: 'Summarize Document' },
                  { id: 'key_points', label: 'Extract Key Takeaways' },
                  { id: 'action_items', label: 'Action Items & Dates' },
                  { id: 'revision_notes', label: 'Study & Revision Notes' },
                  { id: 'qa_pairs', label: 'Comprehension Q&A' },
                ].map((act) => (
                  <button
                    key={act.id}
                    onClick={() => runAiTask(act.id)}
                    disabled={aiLoading}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-[11px] text-slate-700 transition-colors disabled:opacity-50"
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              {/* Chat Message Scroll */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                {aiChatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white ml-4'
                        : 'bg-slate-100 text-slate-800 mr-2 border border-slate-200/80'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1 text-[10px] opacity-75">
                      <span className="font-semibold">{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                      <span className="tabular-nums">{msg.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg text-slate-500 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>Analyzing document text with Gemini...</span>
                  </div>
                )}
              </div>

              {/* Input box */}
              <div className="p-3 border-t border-slate-200 bg-white">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAiSend();
                      }
                    }}
                    placeholder="Ask about this document..."
                    className="w-full pl-3 pr-10 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                  />
                  <button
                    onClick={handleAiSend}
                    disabled={aiLoading || !aiPrompt.trim()}
                    aria-label="Send message to AI assistant"
                    className="absolute right-2 bottom-2.5 p-1 bg-slate-900 text-white hover:bg-slate-800 rounded disabled:opacity-30 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Grounded in document text</span>
                  <span>Press Enter to send</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSPECT & METADATA */}
          {rightTab === 'inspect' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Document Statistics</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400">Total Pages</div>
                    <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
                      {docModel.pageCount}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400">File Size</div>
                    <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
                      {formatBytes(docModel.size)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400">Extracted Words</div>
                    <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
                      {textStats.wordCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400">Est. Read Time</div>
                    <div className="text-base font-bold font-mono text-slate-900 tabular-nums">
                      ~{textStats.readingTimeMinutes} min
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Document Metadata</h4>
                <div className="space-y-1.5 divide-y divide-slate-100">
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-400">Title:</span>
                    <span className="text-slate-800 font-medium truncate max-w-[150px]">
                      {docModel.metadata.title || 'Untitled'}
                    </span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-400">Author:</span>
                    <span className="text-slate-800 font-medium truncate max-w-[150px]">
                      {docModel.metadata.author || 'None'}
                    </span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-400">Producer:</span>
                    <span className="text-slate-800 font-medium truncate max-w-[150px]">
                      {docModel.metadata.producer || 'PDF Studio Pro'}
                    </span>
                  </div>
                  <div className="pt-1 flex justify-between">
                    <span className="text-slate-400">Keywords:</span>
                    <span className="text-slate-800 font-medium truncate max-w-[150px]">
                      {docModel.metadata.keywords || 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Current Page Info</h4>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Page Dimensions:</span>
                    <span className="font-mono text-slate-800">
                      {Math.round(docModel.pages[currentPage - 1]?.width || 595)} ×{' '}
                      {Math.round(docModel.pages[currentPage - 1]?.height || 842)} pt
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Orientation:</span>
                    <span className="font-mono text-slate-800">
                      {(docModel.pages[currentPage - 1]?.width || 0) >
                      (docModel.pages[currentPage - 1]?.height || 0)
                        ? 'Landscape'
                        : 'Portrait'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rotation:</span>
                    <span className="font-mono text-slate-800">
                      {docModel.pages[currentPage - 1]?.rotation || 0}°
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSignatureSaved}
      />
    </div>
  );
};
