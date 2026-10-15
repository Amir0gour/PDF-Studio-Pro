import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface RenderPageResult {
  width: number;
  height: number;
  scale: number;
}

/**
 * Loads a PDF document instance in PDF.js
 */
export async function getPdfJsDocument(bytes: Uint8Array) {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(0),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',
    cMapPacked: true,
  });
  return await loadingTask.promise;
}

/**
 * Renders a specific PDF page onto an HTML Canvas element and renders text layer for selection and editing
 */
export async function renderPageToCanvas(
  pdfDoc: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0,
  rotationOffset: number = 0,
  textLayerContainer?: HTMLElement | null
): Promise<RenderPageResult> {
  const page = await pdfDoc.getPage(pageNumber);
  const rotation = (page.rotate + rotationOffset) % 360;
  const viewport = page.getViewport({ scale, rotation });

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context not available');
  }

  // Support high-DPI displays
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  context.save();
  context.scale(outputScale, outputScale);

  // Background white fill
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, viewport.width, viewport.height);

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await (page.render as any)(renderContext).promise;
  context.restore();

  // Render text layer for text selection, copying, and inline editing
  if (textLayerContainer) {
    try {
      textLayerContainer.innerHTML = '';
      textLayerContainer.style.width = `${Math.floor(viewport.width)}px`;
      textLayerContainer.style.height = `${Math.floor(viewport.height)}px`;
      textLayerContainer.style.setProperty('--scale-factor', `${viewport.scale}`);

      const textContent = await page.getTextContent();
      if ((pdfjsLib as any).TextLayer) {
        const textLayer = new (pdfjsLib as any).TextLayer({
          textContentSource: textContent,
          container: textLayerContainer,
          viewport: viewport,
        });
        await textLayer.render();
      }
    } catch (textErr) {
      console.warn('TextLayer render error:', textErr);
    }
  }

  return {
    width: viewport.width,
    height: viewport.height,
    scale,
  };
}

/**
 * Generates a thumbnail image Data URL for a specific page
 */
export async function generatePageThumbnail(
  pdfDoc: any,
  pageNumber: number,
  targetWidth: number = 160
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1.0 });
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) return '';

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Extracts full text per page using PDF.js
 */
export async function extractAllText(pdfDoc: any): Promise<{
  fullText: string;
  pages: { pageNumber: number; text: string }[];
}> {
  const pages: { pageNumber: number; text: string }[] = [];
  let fullText = '';

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pages.push({ pageNumber: i, text: pageText });
    fullText += `[Page ${i}]\n${pageText}\n\n`;
  }

  return { fullText, pages };
}
