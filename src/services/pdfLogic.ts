/**
 * Pure calculation and parsing utilities for PDF Studio Pro
 * Decoupled from DOM/UI for unit testing and deterministic execution
 */

export interface PageRange {
  start: number; // 1-indexed
  end: number;   // 1-indexed
}

/**
 * Parses page range strings such as "1, 3-5, 8, 10-12" into an array of 0-indexed page numbers.
 * Bounds checks against totalPages.
 */
export function parsePageRangeString(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || !rangeStr.trim()) {
    return [];
  }

  const result = new Set<number>();
  const parts = rangeStr.split(/[,;]+/).map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end));
        const to = Math.min(totalPages, Math.max(start, end));
        for (let i = from; i <= to; i++) {
          result.add(i - 1); // 0-indexed
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        result.add(page - 1); // 0-indexed
      }
    }
  }

  return Array.from(result).sort((a, b) => a - b);
}

/**
 * Formats bytes into human-readable string (KB, MB, etc.)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Calculates compression percentage and ratio
 */
export function calculateCompressionMetrics(originalBytes: number, newBytes: number) {
  const diff = originalBytes - newBytes;
  const ratio = originalBytes > 0 ? ((diff / originalBytes) * 100) : 0;
  return {
    originalBytes,
    newBytes,
    savingsBytes: diff,
    percentageSaved: parseFloat(ratio.toFixed(1)),
    isSmaller: newBytes < originalBytes,
  };
}

/**
 * Normalizes rotation angles to standard PDF rotations (0, 90, 180, 270)
 */
export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return 90;
  if (normalized >= 135 && normalized < 225) return 180;
  if (normalized >= 225 && normalized < 315) return 270;
  return 0;
}

/**
 * Computes word count, character count, and reading time from raw text
 */
export function analyzeTextContent(text: string) {
  if (!text) {
    return {
      wordCount: 0,
      charCount: 0,
      readingTimeMinutes: 0,
      lineCount: 0,
    };
  }

  const cleanText = text.trim();
  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
  const lines = cleanText ? cleanText.split(/\r\n|\r|\n/).filter(line => line.trim().length > 0) : [];
  const wordCount = words.length;
  const charCount = cleanText.length;
  const readingTimeMinutes = Math.ceil(wordCount / 200); // Average 200 wpm

  return {
    wordCount,
    charCount,
    readingTimeMinutes,
    lineCount: lines.length,
  };
}

/**
 * Helper to determine if a point is within an annotation bounding box
 */
export function isPointInAnnotation(
  px: number,
  py: number,
  ann: { x: number; y: number; width: number; height: number }
): boolean {
  return px >= ann.x && px <= ann.x + ann.width && py >= ann.y && py <= ann.y + ann.height;
}

/**
 * Converts CSV content to table grid rows
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split(/\r\n|\n|\r/);
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple split respecting commas
    const cells = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    rows.push(cells);
  }
  return rows;
}

/**
 * Calculates normalized percentage coordinates from bounding client rects
 */
export function calculateNormalizedBounds(
  childRect: { left: number; top: number; width: number; height: number },
  parentRect: { left: number; top: number; width: number; height: number }
): { pctX: number; pctY: number; pctW: number; pctH: number } {
  if (parentRect.width <= 0 || parentRect.height <= 0) {
    return { pctX: 0, pctY: 0, pctW: 0, pctH: 0 };
  }
  const pctX = Math.max(0, Math.min(100, ((childRect.left - parentRect.left) / parentRect.width) * 100));
  const pctY = Math.max(0, Math.min(100, ((childRect.top - parentRect.top) / parentRect.height) * 100));
  const pctW = Math.max(1, Math.min(100, (childRect.width / parentRect.width) * 100));
  const pctH = Math.max(1, Math.min(100, (childRect.height / parentRect.height) * 100));
  return { pctX, pctY, pctW, pctH };
}

/**
 * Creates replacement text annotation parameters covering underlying text
 */
export function createReplacementTextParams(
  originalText: string,
  bounds: { pctX: number; pctY: number; pctW: number; pctH: number },
  fontSize: number = 14
) {
  return {
    type: 'text' as const,
    x: bounds.pctX,
    y: bounds.pctY,
    width: Math.max(bounds.pctW, 14),
    height: Math.max(bounds.pctH, 4),
    text: originalText,
    fontSize,
    backgroundColor: '#ffffff',
    borderStyle: 'dashed' as const,
  };
}
