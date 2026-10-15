/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { EditorWorkspace } from './components/EditorWorkspace';
import { ToolsHub } from './components/ToolsHub';
import { AiView } from './components/AiView';
import { HistoryView } from './components/HistoryView';
import { ToolModals } from './components/ToolModals';
import { PDFDocumentModel, ProcessingHistoryItem } from './types/pdf';
import { loadPdfModel, generateSamplePdf, embedAnnotationsToPdf } from './services/pdfEngine';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'editor' | 'tools' | 'ai' | 'history'>('dashboard');
  const [currentDocument, setCurrentDocument] = useState<PDFDocumentModel | null>(null);
  const [activeModalToolId, setActiveModalToolId] = useState<string | null>(null);
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);

  // Load sample document on initial start or if ?autostart=1 is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart');

    generateSamplePdf().then(async (bytes) => {
      const sampleModel = await loadPdfModel(bytes, 'PDF_Studio_Pro_Specification.pdf', true);
      setCurrentDocument(sampleModel);
      addHistoryRecord('Loaded Demo Document', 'organize', sampleModel.name, 'Generated interactive specification sample PDF', bytes);

      if (autostart === '1') {
        setCurrentTab('editor');
      }
    }).catch(err => console.error('Failed to generate initial sample', err));
  }, []);

  const addHistoryRecord = (
    toolName: string,
    category: any,
    fileName: string,
    detail: string,
    downloadData?: Uint8Array
  ) => {
    const item: ProcessingHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      toolName,
      category,
      fileName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'success',
      detail,
      downloadData,
    };
    setHistory(prev => [item, ...prev]);
  };

  const handleUploadFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const model = await loadPdfModel(bytes, file.name);
      setCurrentDocument(model);
      setCurrentTab('editor');
      addHistoryRecord('Uploaded File', 'edit', file.name, `Loaded ${model.pageCount} page(s) into workspace`, bytes);
    } catch (e: any) {
      alert(`Could not load PDF: ${e.message}`);
    }
  };

  const handleOpenSample = async () => {
    try {
      const bytes = await generateSamplePdf();
      const model = await loadPdfModel(bytes, 'PDF_Studio_Pro_Specification.pdf', true);
      setCurrentDocument(model);
      setCurrentTab('editor');
      addHistoryRecord('Loaded Demo Document', 'organize', model.name, 'Loaded 2-page specification benchmark PDF', bytes);
    } catch (e: any) {
      alert(`Failed to load sample: ${e.message}`);
    }
  };

  const handleUpdateDocument = (updated: PDFDocumentModel, actionDesc?: string) => {
    setCurrentDocument(updated);
    if (actionDesc) {
      addHistoryRecord(actionDesc, 'edit', updated.name, `Applied changes (${updated.pageCount} pages, ${updated.annotations.length} annotations)`);
    }
  };

  const handleDocumentCreated = (newDoc: PDFDocumentModel, actionTitle: string) => {
    setCurrentDocument(newDoc);
    setCurrentTab('editor');
    addHistoryRecord(actionTitle, 'organize', newDoc.name, `Generated new document with ${newDoc.pageCount} page(s)`, newDoc.data);
  };

  const handleDownload = async () => {
    if (!currentDocument) return;
    try {
      const bakedBytes = await embedAnnotationsToPdf(currentDocument.data, currentDocument.annotations);
      const blob = new Blob([bakedBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = currentDocument.name.endsWith('.pdf') ? currentDocument.name : `${currentDocument.name}.pdf`;
      link.click();
      addHistoryRecord('Exported PDF', 'edit', currentDocument.name, 'Downloaded PDF with baked vector annotations', bakedBytes);
    } catch (e: any) {
      alert(`Download failed: ${e.message}`);
    }
  };

  const handleDownloadHistoryItem = (item: ProcessingHistoryItem) => {
    if (!item.downloadData) return;
    const blob = new Blob([item.downloadData as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = item.fileName.endsWith('.pdf') ? item.fileName : `${item.fileName}.pdf`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Universal Top Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentDocument={currentDocument}
        onDownload={handleDownload}
        onOpenSample={handleOpenSample}
      />

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col">
        {currentTab === 'dashboard' && (
          <Dashboard
            onUploadFile={handleUploadFile}
            onOpenSample={handleOpenSample}
            onSelectTool={(id) => setActiveModalToolId(id)}
            onOpenEditor={() => setCurrentTab('editor')}
            currentDocument={currentDocument}
            history={history}
            onDownloadHistoryItem={handleDownloadHistoryItem}
          />
        )}

        {currentTab === 'editor' && (
          currentDocument ? (
            <EditorWorkspace
              document={currentDocument}
              onUpdateDocument={handleUpdateDocument}
              onDownload={handleDownload}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No Document Loaded</h3>
              <p className="text-sm text-slate-500 mb-4 max-w-sm">
                Open a PDF file or start with our enterprise demo document to access the editor.
              </p>
              <button
                onClick={handleOpenSample}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
              >
                Load Interactive Demo Document
              </button>
            </div>
          )
        )}

        {currentTab === 'tools' && (
          <ToolsHub
            onSelectTool={(id) => setActiveModalToolId(id)}
            onOpenEditor={() => setCurrentTab('editor')}
            currentDocument={currentDocument}
          />
        )}

        {currentTab === 'ai' && (
          <AiView
            currentDocument={currentDocument}
            onOpenSample={handleOpenSample}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            history={history}
            onDownloadItem={handleDownloadHistoryItem}
            onClearHistory={() => setHistory([])}
          />
        )}
      </main>

      {/* Action Dialogs */}
      <ToolModals
        toolId={activeModalToolId}
        currentDocument={currentDocument}
        onClose={() => setActiveModalToolId(null)}
        onDocumentCreated={handleDocumentCreated}
      />
    </div>
  );
}
