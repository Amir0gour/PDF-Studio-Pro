import React from 'react';
import { Download, FileCheck, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { ProcessingHistoryItem } from '../types/pdf';

interface HistoryViewProps {
  history: ProcessingHistoryItem[];
  onDownloadItem: (item: ProcessingHistoryItem) => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onDownloadItem,
  onClearHistory,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Processing Audit History</h1>
          <p className="text-sm text-slate-500 mt-1">
            Session history of all executed PDF operations, exports, and transformations.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Log
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No Operations Recorded Yet</p>
            <p className="text-xs">
              Every document merge, split, annotation, compression, and export will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Operation</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">File Name</th>
                  <th className="px-6 py-3.5">Execution Details</th>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{row.toolName}</span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 font-mono capitalize">
                      {row.category}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-800 truncate max-w-xs">
                      {row.fileName}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 truncate max-w-sm">
                      {row.detail}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-400 tabular-nums">
                      {row.timestamp}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {row.downloadData ? (
                        <button
                          onClick={() => onDownloadItem(row)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Applied in Editor</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
