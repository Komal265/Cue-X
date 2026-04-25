import React, { useState, useEffect } from 'react';
import { Database, Calendar, ArrowRight, Loader2 } from 'lucide-react';
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

export const DatasetSelector: React.FC<DatasetSelectorProps> = ({ workspaceId, onDatasetSelect, selectedDatasetId }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/datasets`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setDatasets(data);
        }
      } catch (err) {
        console.error("Failed to fetch datasets", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceId) fetchDatasets();
  }, [workspaceId]);

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
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg">
                <Database className="w-4 h-4 text-neutral-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{ds.filename}</div>
                <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(ds.created_at).toLocaleDateString()} at {new Date(ds.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            
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
        ))}
      </div>
    </div>
  );
};
