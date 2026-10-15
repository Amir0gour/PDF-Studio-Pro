import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { Annotation, DocumentMetadata, PageDetail, PDFDocumentModel } from '../types/pdf';
import { getPdfJsDocument, renderPageToCanvas, generatePageThumbnail } from './pdfRenderer';
import { normalizeRotation } from './pdfLogic';

/**
 * Loads a PDF with pdf-lib and retrieves its structural metadata
 */
export async function loadPdfModel(
  bytes: Uint8Array,
  fileName: string = 'document.pdf',
  isSample: boolean = false
): Promise<PDFDocumentModel> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = doc.getPageCount();

  const metadata: DocumentMetadata = {
    title: doc.getTitle() || undefined,
    author: doc.getAuthor() || undefined,
    subject: doc.getSubject() || undefined,
    keywords: doc.getKeywords() || undefined,
    creator: doc.getCreator() || undefined,
    producer: doc.getProducer() || undefined,
    creationDate: doc.getCreationDate() ? doc.getCreationDate()?.toISOString() : undefined,
    modificationDate: doc.getModificationDate() ? doc.getModificationDate()?.toISOString() : undefined,
  };

  const pages: PageDetail[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    pages.push({
      pageNumber: i + 1,
      pageIndex: i,
      width,
      height,
      rotation: page.getRotation().angle,
    });
  }

  return {
    id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: fileName,
    size: bytes.byteLength,
    data: bytes,
    pageCount,
    pages,
    metadata,
    annotations: [],
    isSample,
  };
}

/**
 * Merges multiple PDF Uint8Arrays in sequence
 */
export async function mergePdfs(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of copiedPages) {
      mergedDoc.addPage(page);
    }
  }

  return await mergedDoc.save();
}

/**
 * Extracts specified 0-indexed page numbers into a new PDF
 */
export async function extractPages(docBytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  const validIndices = pageIndices.filter(i => i >= 0 && i < srcDoc.getPageCount());
  if (validIndices.length === 0) {
    throw new Error('No valid pages selected for extraction.');
  }

  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return await newDoc.save();
}

/**
 * Deletes specified 0-indexed page numbers from the PDF
 */
export async function deletePages(docBytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  const total = doc.getPageCount();

  if (pageIndices.length >= total) {
    throw new Error('Cannot delete all pages of the document.');
  }

  // Delete in reverse order so indices do not shift
  const sorted = [...pageIndices].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < doc.getPageCount()) {
      doc.removePage(idx);
    }
  }

  return await doc.save();
}

/**
 * Rotates specified pages by a given angle (+90, -90, 180)
 */
export async function rotatePages(
  docBytes: Uint8Array,
  pageIndices: number[],
  angleDegrees: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  for (const idx of pageIndices) {
    if (idx >= 0 && idx < doc.getPageCount()) {
      const page = doc.getPage(idx);
      const current = page.getRotation().angle;
      const newAngle = normalizeRotation(current + angleDegrees);
      page.setRotation(degrees(newAngle));
    }
  }
  return await doc.save();
}

/**
 * Reorders pages according to an array of original 0-indexed page numbers
 */
export async function reorderPages(docBytes: Uint8Array, newOrderIndices: number[]): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  const copiedPages = await newDoc.copyPages(srcDoc, newOrderIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return await newDoc.save();
}

/**
 * Duplicates a specified 0-indexed page
 */
export async function duplicatePage(docBytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  if (pageIndex < 0 || pageIndex >= doc.getPageCount()) {
    throw new Error('Invalid page index for duplication.');
  }

  const [copiedPage] = await doc.copyPages(doc, [pageIndex]);
  doc.insertPage(pageIndex + 1, copiedPage);

  return await doc.save();
}

/**
 * Converts a list of image Data URLs (PNG, JPEG) into a single PDF document
 */
export async function imagesToPdf(
  images: { dataUrl: string; name?: string }[],
  options?: { pageSize?: 'A4' | 'fit' }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const img of images) {
    let embeddedImage;
    if (img.dataUrl.includes('image/png')) {
      const base64 = img.dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      embeddedImage = await doc.embedPng(bytes);
    } else {
      const base64 = img.dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      embeddedImage = await doc.embedJpg(bytes);
    }

    const imgDims = embeddedImage.scale(1);
    let pageWidth = imgDims.width;
    let pageHeight = imgDims.height;

    if (options?.pageSize === 'A4') {
      pageWidth = 595.28;
      pageHeight = 841.89;
      const page = doc.addPage([pageWidth, pageHeight]);
      const scaled = embeddedImage.scaleToFit(pageWidth - 40, pageHeight - 40);
      page.drawImage(embeddedImage, {
        x: (pageWidth - scaled.width) / 2,
        y: (pageHeight - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      });
    } else {
      const page = doc.addPage([pageWidth, pageHeight]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }
  }

  return await doc.save();
}

/**
 * Exports each page of the PDF as an image (PNG/JPEG) using PDF.js off-screen canvas
 */
export async function exportPagesAsImages(
  docBytes: Uint8Array,
  format: 'png' | 'jpeg' = 'png',
  scale: number = 2.0
): Promise<{ pageNumber: number; dataUrl: string; blob: Blob }[]> {
  const pdfJsDoc = await getPdfJsDocument(docBytes);
  const results: { pageNumber: number; dataUrl: string; blob: Blob }[] = [];

  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await (page.render as any)({ canvasContext: context, viewport, canvas }).promise;

      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, 0.92);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), mimeType, 0.92);
      });

      results.push({ pageNumber: i, dataUrl, blob });
    }
  }

  return results;
}

/**
 * Parses hex color to RGB ratios (0..1)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

/**
 * Embeds annotations (text overlays, highlights, shapes, drawings, signatures) into PDF bytes
 */
export async function embedAnnotationsToPdf(
  docBytes: Uint8Array,
  annotations: Annotation[]
): Promise<Uint8Array> {
  if (!annotations || annotations.length === 0) {
    return docBytes;
  }

  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  const helveticaFont = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const ann of annotations) {
    if (ann.pageIndex < 0 || ann.pageIndex >= doc.getPageCount()) continue;

    const page = doc.getPage(ann.pageIndex);
    const { width: pWidth, height: pHeight } = page.getSize();

    // Convert from percentage (0-100) to PDF coordinate points (origin at bottom-left)
    const pdfX = (ann.x / 100) * pWidth;
    const pdfW = (ann.width / 100) * pWidth;
    const pdfH = (ann.height / 100) * pHeight;
    // PDF Y coordinates start from bottom
    const pdfY = pHeight - ((ann.y / 100) * pHeight) - pdfH;

    const { r, g, b } = hexToRgb(ann.color || '#2563eb');

    switch (ann.type) {
      case 'highlight': {
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          color: rgb(r, g, b),
          opacity: ann.opacity || 0.35,
        });
        break;
      }

      case 'underline': {
        page.drawLine({
          start: { x: pdfX, y: pdfY },
          end: { x: pdfX + pdfW, y: pdfY },
          thickness: ann.strokeWidth || 2,
          color: rgb(r, g, b),
          opacity: ann.opacity || 1.0,
        });
        break;
      }

      case 'strikethrough': {
        page.drawLine({
          start: { x: pdfX, y: pdfY + pdfH / 2 },
          end: { x: pdfX + pdfW, y: pdfY + pdfH / 2 },
          thickness: ann.strokeWidth || 2,
          color: rgb(r, g, b),
          opacity: ann.opacity || 1.0,
        });
        break;
      }

      case 'rectangle': {
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          borderColor: rgb(r, g, b),
          borderWidth: ann.strokeWidth || 2,
          opacity: ann.opacity || 1.0,
        });
        break;
      }

      case 'circle': {
        page.drawEllipse({
          x: pdfX + pdfW / 2,
          y: pdfY + pdfH / 2,
          xScale: pdfW / 2,
          yScale: pdfH / 2,
          borderColor: rgb(r, g, b),
          borderWidth: ann.strokeWidth || 2,
          opacity: ann.opacity || 1.0,
        });
        break;
      }

      case 'blackout': {
        // Redaction: Permanent black rectangular redaction
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          color: rgb(0, 0, 0),
          opacity: 1.0,
        });
        break;
      }

      case 'line': {
        page.drawLine({
          start: { x: pdfX, y: pdfY + pdfH / 2 },
          end: { x: pdfX + pdfW, y: pdfY + pdfH / 2 },
          thickness: ann.strokeWidth || 2,
          color: rgb(r, g, b),
          opacity: ann.opacity || 1.0,
        });
        break;
      }

      case 'arrow': {
        const startX = pdfX;
        const startY = pdfY + pdfH / 2;
        const endX = pdfX + pdfW;
        const endY = pdfY + pdfH / 2;
        page.drawLine({
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
          thickness: ann.strokeWidth || 2,
          color: rgb(r, g, b),
          opacity: ann.opacity || 1.0,
        });
        // Arrowhead
        const headLen = Math.min(12, pdfW * 0.25);
        page.drawLine({
          start: { x: endX, y: endY },
          end: { x: endX - headLen, y: endY + headLen * 0.6 },
          thickness: ann.strokeWidth || 2,
          color: rgb(r, g, b),
          opacity: ann.opacity || 1.0,
        });
        page.drawLine({
          start: { x: endX, y: endY },
          end: { x: endX - headLen, y: endY - headLen * 0.6 },
          thickness: ann.strokeWidth || 2,
          color: rgb(r, g, b),
          opacity: ann.opacity || 1.0,
        });
        break;
      }

      case 'stamp': {
        const stampText = ann.stampType || ann.text || 'APPROVED';
        let stampColor = rgb(0.1, 0.6, 0.2); // Green for approved
        if (stampText.includes('CONFIDENTIAL') || stampText.includes('VOID')) {
          stampColor = rgb(0.8, 0.1, 0.1); // Red
        } else if (stampText.includes('DRAFT')) {
          stampColor = rgb(0.85, 0.55, 0.1); // Amber
        } else if (stampText.includes('RECEIVED')) {
          stampColor = rgb(0.15, 0.45, 0.85); // Blue
        }

        // Draw double border
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          borderColor: stampColor,
          borderWidth: 2.5,
          color: rgb(1, 1, 1),
          opacity: 0.9,
        });
        page.drawRectangle({
          x: pdfX + 3,
          y: pdfY + 3,
          width: pdfW - 6,
          height: pdfH - 6,
          borderColor: stampColor,
          borderWidth: 1,
          opacity: 0.8,
        });

        const stampFontSize = Math.min(pdfH * 0.45, (pdfW / stampText.length) * 1.5, 20);
        page.drawText(stampText, {
          x: pdfX + (pdfW - stampText.length * stampFontSize * 0.58) / 2,
          y: pdfY + (pdfH - stampFontSize) / 2 + 3,
          size: stampFontSize,
          font: helveticaBold,
          color: stampColor,
        });
        break;
      }

      case 'check': {
        // Draw green checkmark
        page.drawLine({
          start: { x: pdfX + pdfW * 0.2, y: pdfY + pdfH * 0.5 },
          end: { x: pdfX + pdfW * 0.45, y: pdfY + pdfH * 0.2 },
          thickness: ann.strokeWidth || 3,
          color: rgb(0.1, 0.65, 0.2),
          opacity: 1.0,
        });
        page.drawLine({
          start: { x: pdfX + pdfW * 0.45, y: pdfY + pdfH * 0.2 },
          end: { x: pdfX + pdfW * 0.85, y: pdfY + pdfH * 0.8 },
          thickness: ann.strokeWidth || 3,
          color: rgb(0.1, 0.65, 0.2),
          opacity: 1.0,
        });
        break;
      }

      case 'cross': {
        // Draw red cross
        page.drawLine({
          start: { x: pdfX + pdfW * 0.2, y: pdfY + pdfH * 0.8 },
          end: { x: pdfX + pdfW * 0.8, y: pdfY + pdfH * 0.2 },
          thickness: ann.strokeWidth || 3,
          color: rgb(0.8, 0.15, 0.15),
          opacity: 1.0,
        });
        page.drawLine({
          start: { x: pdfX + pdfW * 0.2, y: pdfY + pdfH * 0.2 },
          end: { x: pdfX + pdfW * 0.8, y: pdfY + pdfH * 0.8 },
          thickness: ann.strokeWidth || 3,
          color: rgb(0.8, 0.15, 0.15),
          opacity: 1.0,
        });
        break;
      }

      case 'watermark': {
        const wmText = ann.text || 'CONFIDENTIAL';
        const wmFontSize = Math.min(pWidth * 0.12, 60);
        page.drawText(wmText, {
          x: pWidth * 0.15,
          y: pHeight * 0.45,
          size: wmFontSize,
          font: helveticaBold,
          color: rgb(0.7, 0.7, 0.7),
          opacity: ann.opacity || 0.2,
          rotate: degrees(35),
        });
        break;
      }

      case 'text':
      case 'sticky':
      case 'callout':
      case 'date': {
        if (ann.backgroundColor || ann.type === 'callout') {
          const bgRgb = hexToRgb(ann.backgroundColor || (ann.type === 'callout' ? '#eff6ff' : '#ffffff'));
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
            borderColor: ann.type === 'callout' ? rgb(0.2, 0.4, 0.9) : undefined,
            borderWidth: ann.type === 'callout' ? 1.5 : undefined,
            opacity: 0.95,
          });
          // Draw small callout pointer notch at bottom-left if callout
          if (ann.type === 'callout') {
            page.drawLine({
              start: { x: pdfX + 8, y: pdfY },
              end: { x: pdfX - 4, y: pdfY - 8 },
              thickness: 1.5,
              color: rgb(0.2, 0.4, 0.9),
            });
            page.drawLine({
              start: { x: pdfX + 16, y: pdfY },
              end: { x: pdfX - 4, y: pdfY - 8 },
              thickness: 1.5,
              color: rgb(0.2, 0.4, 0.9),
            });
          }
        }

        if (ann.type === 'sticky') {
          // Draw sticky note background box
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: rgb(0.99, 0.95, 0.7),
            borderColor: rgb(0.9, 0.8, 0.4),
            borderWidth: 1,
            opacity: 0.95,
          });
        }

        if (ann.type === 'date') {
          // Draw neat badge for date
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: rgb(0.95, 0.96, 0.98),
            borderColor: rgb(0.7, 0.75, 0.85),
            borderWidth: 1,
            opacity: 1.0,
          });
        }

        if (ann.text) {
          const font = ann.fontWeight === 'bold' ? helveticaBold : helveticaFont;
          const fontSize = ann.fontSize || (ann.type === 'sticky' ? 10 : ann.type === 'date' ? 11 : 14);
          const lines = ann.text.split('\n');
          let textY = pdfY + pdfH - fontSize - 4;

          for (const line of lines) {
            page.drawText(line, {
              x: pdfX + 4,
              y: textY,
              size: fontSize,
              font,
              color: rgb(r, g, b),
              maxWidth: pdfW - 8,
            });
            textY -= fontSize * 1.3;
          }
        }
        break;
      }

      case 'erase_overlay': {
        // Overlay editing: cover existing content with clean white rectangle
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfW,
          height: pdfH,
          color: rgb(1, 1, 1),
          opacity: 1.0,
        });
        if (ann.text) {
          page.drawText(ann.text, {
            x: pdfX + 2,
            y: pdfY + (pdfH - (ann.fontSize || 12)) / 2,
            size: ann.fontSize || 12,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }
        break;
      }

      case 'signature':
      case 'image': {
        if (ann.imageDataUrl) {
          try {
            let embeddedImg;
            const base64 = ann.imageDataUrl.split(',')[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

            if (ann.imageDataUrl.includes('image/png')) {
              embeddedImg = await doc.embedPng(bytes);
            } else {
              embeddedImg = await doc.embedJpg(bytes);
            }

            page.drawImage(embeddedImg, {
              x: pdfX,
              y: pdfY,
              width: pdfW,
              height: pdfH,
              opacity: ann.opacity || 1.0,
            });
          } catch (e) {
            console.error('Failed to embed image/signature onto PDF', e);
          }
        }
        break;
      }

      case 'draw': {
        // If freehand points exist, draw connected lines
        if (ann.points && ann.points.length > 1) {
          for (let p = 0; p < ann.points.length - 1; p++) {
            const p1 = ann.points[p];
            const p2 = ann.points[p + 1];
            page.drawLine({
              start: {
                x: (p1.x / 100) * pWidth,
                y: pHeight - (p1.y / 100) * pHeight,
              },
              end: {
                x: (p2.x / 100) * pWidth,
                y: pHeight - (p2.y / 100) * pHeight,
              },
              thickness: ann.strokeWidth || 2,
              color: rgb(r, g, b),
              opacity: ann.opacity || 1.0,
            });
          }
        }
        break;
      }
    }
  }

  return await doc.save();
}

/**
 * Adds watermarks across all pages in document
 */
export async function addWatermarkToAllPages(
  docBytes: Uint8Array,
  text: string = 'CONFIDENTIAL',
  opacity: number = 0.25
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const total = doc.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const fontSize = Math.min(width * 0.12, 60);
    page.drawText(text, {
      x: width * 0.15,
      y: height * 0.45,
      size: fontSize,
      font,
      color: rgb(0.65, 0.65, 0.65),
      opacity,
      rotate: degrees(35),
    });
  }

  return await doc.save();
}

/**
 * Adds Page Numbers (Bates/Footer numbering) across all pages
 */
export async function addPageNumbersToPdf(
  docBytes: Uint8Array,
  format: 'Page {n} of {total}' | '{n}' | 'Bates-{n}' = 'Page {n} of {total}',
  position: 'bottom-center' | 'bottom-right' | 'top-right' = 'bottom-center'
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();

  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const pageNum = i + 1;
    let text = format.replace('{n}', pageNum.toString()).replace('{total}', total.toString());
    if (format === 'Bates-{n}') {
      text = `Bates: ${pageNum.toString().padStart(6, '0')}`;
    }

    const fontSize = 9;
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    let x = (width - textWidth) / 2;
    let y = 25;

    if (position === 'bottom-right') {
      x = width - textWidth - 36;
      y = 25;
    } else if (position === 'top-right') {
      x = width - textWidth - 36;
      y = height - 30;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.35, 0.4, 0.45),
    });
  }

  return await doc.save();
}

/**
 * Optimizes PDF size through compression preset
 */
export async function compressPdf(
  docBytes: Uint8Array,
  preset: 'low' | 'medium' | 'high'
): Promise<{ bytes: Uint8Array; originalSize: number; newSize: number; ratio: number }> {
  const originalSize = docBytes.byteLength;
  const doc = await PDFDocument.load(docBytes, { ignoreEncryption: true });

  if (preset === 'high') {
    // Strip unnecessary metadata for maximum compression
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setProducer('PDF Studio Pro Optimizer');
    doc.setCreator('PDF Studio Pro');
  }

  // Save with object streams and stripped unused entries
  const optimizedBytes = await doc.save({
    useObjectStreams: true,
  });

  const newSize = optimizedBytes.byteLength;
  const savings = originalSize - newSize;
  const ratio = originalSize > 0 ? (savings / originalSize) * 100 : 0;

  return {
    bytes: optimizedBytes,
    originalSize,
    newSize,
    ratio: parseFloat(ratio.toFixed(2)),
  };
}

/**
 * Generates an elegant, realistic sample multi-page PDF document
 */
export async function generateSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Executive Brief & Architecture
  const page1 = doc.addPage([595.28, 841.89]); // A4
  page1.drawRectangle({
    x: 0,
    y: 780,
    width: 595.28,
    height: 62,
    color: rgb(0.08, 0.12, 0.18),
  });
  page1.drawText('PDF STUDIO PRO', {
    x: 40,
    y: 805,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page1.drawText('ENTERPRISE DOCUMENT SPECIFICATION', {
    x: 40,
    y: 792,
    size: 8,
    font: fontRegular,
    color: rgb(0.6, 0.7, 0.8),
  });

  page1.drawText('Executive Summary & Platform Architecture', {
    x: 40,
    y: 730,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const p1Text = [
    'PDF Studio Pro is a high-performance, browser-native PDF management and editing system.',
    'Engineered for security, document privacy, and precision, all standard transformations execute',
    'directly within client memory using zero-telemetry WebAssembly and PDF rendering pipelines.',
    'Key platform capabilities include lossless page merging, structural page extraction, interactive',
    'freehand annotations, digital signature stamping, and deep AI-assisted semantic analysis.',
  ];

  let curY = 690;
  for (const line of p1Text) {
    page1.drawText(line, {
      x: 40,
      y: curY,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3),
    });
    curY -= 16;
  }

  // Draw a structured table
  page1.drawText('Platform Capability Benchmark Matrix', {
    x: 40,
    y: 580,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const tableRows = [
    ['Module', 'Execution Target', 'Latency Budget', 'Status'],
    ['Page Merge & Split', 'Client-side WebWorker', '< 120ms', 'Verified'],
    ['Vector Annotation Engine', 'Offscreen Canvas', '< 16ms', 'Verified'],
    ['Multimodal Vision OCR', 'Server API (Gemini)', '< 1.8s', 'Active'],
    ['Document Privacy Sandbox', 'Local Browser Cache', '0ms (Air-gapped)', 'Enforced'],
  ];

  let tableY = 550;
  page1.drawRectangle({
    x: 40,
    y: tableY - 5,
    width: 515,
    height: 24,
    color: rgb(0.93, 0.95, 0.98),
  });

  for (let r = 0; r < tableRows.length; r++) {
    const row = tableRows[r];
    const isHeader = r === 0;
    const font = isHeader ? fontBold : fontRegular;
    const color = isHeader ? rgb(0.1, 0.15, 0.2) : rgb(0.25, 0.3, 0.35);

    page1.drawText(row[0], { x: 50, y: tableY, size: 9, font, color });
    page1.drawText(row[1], { x: 190, y: tableY, size: 9, font, color });
    page1.drawText(row[2], { x: 360, y: tableY, size: 9, font, color });
    page1.drawText(row[3], { x: 470, y: tableY, size: 9, font, color });

    tableY -= 22;
    page1.drawLine({
      start: { x: 40, y: tableY + 16 },
      end: { x: 555, y: tableY + 16 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });
  }

  // Page 2: Compliance, Security & Signature Page
  const page2 = doc.addPage([595.28, 841.89]);
  page2.drawRectangle({
    x: 0,
    y: 780,
    width: 595.28,
    height: 62,
    color: rgb(0.08, 0.12, 0.18),
  });
  page2.drawText('PDF STUDIO PRO', {
    x: 40,
    y: 805,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page2.drawText('VERIFICATION & COMPLIANCE RECORD', {
    x: 40,
    y: 792,
    size: 8,
    font: fontRegular,
    color: rgb(0.6, 0.7, 0.8),
  });

  page2.drawText('Security Attestation & Audit Trail', {
    x: 40,
    y: 730,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const p2Text = [
    'Document confidentiality is maintained under zero-persistence policies.',
    'Files uploaded for browser-side manipulation remain unexposed to remote clouds.',
    'Cryptographic hashing ensures byte-level integrity across revision operations.',
    'Action Items & Deadlines:',
    '· Complete ISO 27001 data processing appendix review by November 2026.',
    '· Implement localized WebAssembly font embedding for customized typography.',
    '· Validate automated redaction compliance against NIST SP 800-88 guidelines.',
  ];

  let p2Y = 690;
  for (const line of p2Text) {
    page2.drawText(line, {
      x: 40,
      y: p2Y,
      size: 10,
      font: line.startsWith('·') ? fontRegular : (line.includes(':') ? fontBold : fontRegular),
      color: rgb(0.2, 0.25, 0.3),
    });
    p2Y -= 18;
  }

  // Draw Signature line box
  page2.drawRectangle({
    x: 40,
    y: 400,
    width: 250,
    height: 100,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });
  page2.drawText('Authorized Signature Box', {
    x: 50,
    y: 480,
    size: 9,
    font: fontBold,
    color: rgb(0.4, 0.45, 0.5),
  });
  page2.drawLine({
    start: { x: 50, y: 425 },
    end: { x: 270, y: 425 },
    thickness: 1,
    color: rgb(0.6, 0.65, 0.7),
  });
  page2.drawText('Sign here using PDF Studio Pro Signature Tool', {
    x: 50,
    y: 410,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6),
  });

  doc.setTitle('PDF Studio Pro Specification');
  doc.setAuthor('PDF Studio Pro Architecture Team');
  doc.setSubject('Engineering Specifications and Benchmark Matrix');
  doc.setKeywords(['PDF', 'Editor', 'Studio', 'Specifications', 'Security']);
  doc.setCreator('PDF Studio Pro Engine');

  return await doc.save();
}
