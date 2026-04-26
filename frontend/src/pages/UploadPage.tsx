import { useState, useEffect } from 'react';
import type { DragEvent } from 'react';
import { Upload, Play } from 'lucide-react';
import { AppBackground } from '../components/ui/AppBackground';
import { WorkspaceSelector } from '../components/WorkspaceSelector';
import { DatasetSelector } from '../components/DatasetSelector';
import { getAuthHeaders } from '../utils/api';

const UploadPage = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(() => {
    const saved = localStorage.getItem('cuex_workspace_id');
    return saved ? parseInt(saved) : null;
  });

  useEffect(() => {
    if (selectedWorkspaceId) {
      localStorage.setItem('cuex_workspace_id', selectedWorkspaceId.toString());
    }
  }, [selectedWorkspaceId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedWorkspaceId) {
      setError(selectedWorkspaceId ? 'Please select a file' : 'Please select a workspace');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspace_id', selectedWorkspaceId.toString());

    try {
      const response = await fetch(`${API_URL}/upload`, { 
        method: 'POST', 
        headers: getAuthHeaders(),
        body: formData 
      });
      const data = await response.json();
      if (response.ok) {
        // Redirection to dashboard with dataset_id
        window.location.href = `/dashboard/${data.dataset_id}`;
      } else {
        const details = data?.details ? `\n${JSON.stringify(data.details, null, 2)}` : '';
        setError(`${data.error || 'Upload failed'}${details}`);
      }
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-neutral-200 font-sans selection:bg-white/20 overflow-hidden flex flex-col">
      <AppBackground />

      <div className="relative z-10 max-w-4xl w-full mx-auto p-8 pt-24 pb-32 flex-1 flex flex-col items-center">
        {/* Header section */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Workspace & Data
          </h1>
          <p className="text-neutral-500 text-lg">
            Select a workspace to upload new data or view existing analysis.
          </p>
        </div>

        {/* Step 1: Workspace Selection */}
        <WorkspaceSelector 
          selectedWorkspaceId={selectedWorkspaceId}
          onWorkspaceSelect={setSelectedWorkspaceId}
        />

        {selectedWorkspaceId && (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-full max-w-2xl h-px bg-white/10 my-8" />
            
            <form onSubmit={handleUpload} className="w-full flex flex-col items-center">
              <h2 className="text-lg font-medium text-white self-start mb-4 max-w-2xl mx-auto w-full">Upload New Dataset</h2>
              {/* Drag & Drop Zone */}
              <label 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full max-w-2xl min-h-[280px] border border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group mb-8 overflow-hidden relative glass-card ${
                  isDragging 
                    ? 'border-blue-500/50 bg-blue-500/5' 
                    : 'hover:border-white/20'
                }`}
                style={isDragging ? {} : { background: 'rgba(255, 255, 255, 0.02)' }}
              >
                <div className="flex flex-col items-center text-center z-10 px-6">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-7 h-7 text-neutral-400 group-hover:text-white transition-colors" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">{file ? file.name : "Drag & Drop CSV"}</h3>
                  <p className="text-sm text-neutral-500 max-w-[320px] leading-relaxed">
                    {file ? "Ready for analysis." : "Upload customer transaction data to this workspace."}
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              {error && (
                <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-2xl w-full text-center">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-red-400">
                    {error}
                  </pre>
                </div>
              )}

              {/* Action Button */}
              <button
                type="submit"
                disabled={!file || isLoading}
                className="px-8 h-12 bg-white hover:bg-neutral-200 text-black text-sm font-medium rounded-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white mb-12"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black" strokeWidth={1.5} />
                    Process Dataset
                  </>
                )}
              </button>
            </form>

            <div className="w-full max-w-2xl h-px bg-white/10 mb-8" />
            
            {/* Step 3: Existing Datasets */}
            <DatasetSelector workspaceId={selectedWorkspaceId} />
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
