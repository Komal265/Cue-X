import React, { useState, useEffect, useCallback } from 'react';
import { Database, Calendar, ArrowRight, Loader2, Trash2, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../utils/api';

interface Dataset {
  id: number;
  filename: string;
  created_at: string;
  uploaded_at: string;
  row_count: number;
}

interface DatasetSelectorProps {
  workspaceId: number;
  onDatasetSelect?: (id: number) => void;
  selectedDatasetId?: number | null;
}

// ── Minimal toast state ───────────────────────────────────────────────────────
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastCounter = 0;

// ── Confirmation Modal ────────────────────────────────────────────────────────
interface ConfirmModalProps {
  filename: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ filename, isDeleting, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
    {/* Backdrop */}
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
    {/* Panel */}
    <div className="relative z-10 w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Delete Dataset?</h2>
          <p className="text-sm text-neutral-400 mt-1 leading-relaxed">
            This will permanently delete <span className="text-white font-medium">"{filename}"</span> along with all
            customer data, segments, and analytics. This action cannot be undone.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="ml-auto flex-shrink-0 text-neutral-600 hover:text-neutral-300 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-500 border border-red-500/50 transition-all disabled:opacity-60 flex items-center gap-2"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
export const DatasetSelector: React.FC<DatasetSelectorProps> = ({ workspaceId, onDatasetSelect, selectedDatasetId }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const navigate = useNavigate();

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/datasets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDatasets(data);
      }
    } catch (err) {
      console.error('Failed to fetch datasets', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) fetchDatasets();
  }, [workspaceId, fetchDatasets]);

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/workspaces/dataset/${pendingDeleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        // Remove from UI immediately
        setDatasets(prev => prev.filter(d => d.id !== pendingDeleteId));
        showToast('Dataset deleted successfully', 'success');
        setPendingDeleteId(null);
      } else {
        showToast(data.error || 'Failed to delete dataset', 'error');
      }
    } catch {
      showToast('Failed to delete dataset', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingDataset = datasets.find(d => d.id === pendingDeleteId);

  if (isLoading) {
    return <div className="text-sm text-neutral-500 animate-pulse flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading datasets...</div>;
  }

  if (datasets.length === 0) {
    return (
      <div className="py-8 text-center border border-dashed border-white/10 rounded-2xl w-full max-w-2xl">
        <p className="text-sm text-neutral-500">No datasets found in this workspace.</p>
      </div>
    );
  }

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-xl border pointer-events-auto transition-all ${
              t.type === 'success'
                ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-300'
                : 'bg-red-900/80 border-red-500/30 text-red-300'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {pendingDeleteId && pendingDataset && (
        <ConfirmModal
          filename={pendingDataset.filename}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => !isDeleting && setPendingDeleteId(null)}
        />
      )}

      <div className="w-full max-w-2xl mt-6">
        <h2 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-neutral-400" />
          Existing Datasets
        </h2>
        <div className="space-y-2">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                selectedDatasetId === ds.id
                  ? 'bg-white/10 border-white/30'
                  : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-2 bg-white/5 rounded-lg flex-shrink-0">
                  <Database className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{ds.filename}</div>
                  <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(ds.uploaded_at || ds.created_at).toLocaleDateString()} at {new Date(ds.uploaded_at || ds.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {ds.row_count != null && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">{ds.row_count.toLocaleString()} rows</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingDeleteId(ds.id); }}
                  title="Delete dataset"
                  className="p-2 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Open dashboard */}
                <button
                  onClick={() => {
                    if (onDatasetSelect) {
                      onDatasetSelect(ds.id);
                    } else {
                      navigate(`/dashboard/${ds.id}`);
                    }
                  }}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
