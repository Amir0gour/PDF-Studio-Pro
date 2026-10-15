export type ActiveTool =
  | 'select'
  | 'edit_content'
  | 'hand'
  | 'text'
  | 'callout'
  | 'date'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'draw'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'sticky'
  | 'signature'
  | 'image'
  | 'erase_overlay'
  | 'blackout'
  | 'stamp'
  | 'check'
  | 'cross'
  | 'watermark';

export interface PageDetail {
  pageNumber: number; // 1-indexed
  pageIndex: number;  // 0-indexed
  width: number;
  height: number;
  rotation: number;   // 0, 90, 180, 270
  thumbnailUrl?: string;
}

export interface Annotation {
  id: string;
  pageIndex: number; // 0-indexed
  type: ActiveTool;
  x: number;         // percentage of page width (0 to 100) or PDF coordinate
  y: number;         // percentage of page height (0 to 100) or PDF coordinate
  width: number;
  height: number;
  color: string;
  fillColor?: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  text?: string;
  points?: { x: number; y: number }[]; // For freehand drawing & arrows & lines
  imageDataUrl?: string;               // For signatures and placed images
  stampType?: string;                  // e.g. 'APPROVED', 'CONFIDENTIAL', 'DRAFT', 'VOID'
  backgroundColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  author?: string;
  createdAt: string;
  selected?: boolean;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface PDFDocumentModel {
  id: string;
  name: string;
  size: number;
  data: Uint8Array;
  pageCount: number;
  pages: PageDetail[];
  metadata: DocumentMetadata;
  annotations: Annotation[];
  isSample?: boolean;
}

export type ToolCategory =
  | 'organize'
  | 'edit'
  | 'convert'
  | 'optimize'
  | 'security'
  | 'analyze';

export interface ToolDefinition {
  id: string;
  title: string;
  category: ToolCategory;
  description: string;
  iconName: string;
  badge?: string;
  actionType: string;
  isAvailable: boolean;
}

export interface ProcessingHistoryItem {
  id: string;
  toolName: string;
  category: ToolCategory;
  fileName: string;
  timestamp: string;
  status: 'success' | 'failed' | 'in_progress';
  detail: string;
  downloadData?: Uint8Array;
  downloadName?: string;
}

export interface AIAnalysisResult {
  task: string;
  title: string;
  content: string;
  timestamp: string;
}
