import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Check } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';

interface Workspace {
  id: number;
  name: string;
  created_at: string;
}

interface WorkspaceSelectorProps {
  onWorkspaceSelect: (id: number) => void;
  selectedWorkspaceId: number | null;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ onWorkspaceSelect, selectedWorkspaceId }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetchWithAuth('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setWorkspaces(data);
      }
    } catch (err) {
      console.error("Failed to fetch workspaces", err);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setCreateError(null);
    setIsLoading(true);
    try {
      const res = await fetchWithAuth('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName.trim() })
      });
      let data: { error?: string; workspace_id?: number } = {};
      try {
        data = await res.json();
      } catch {
        setCreateError(`Request failed (${res.status}). Check that the API is running.`);
        return;
      }
      if (res.ok && data.workspace_id != null) {
        setNewWorkspaceName('');
        setIsCreating(false);
        await fetchWorkspaces();
        onWorkspaceSelect(data.workspace_id);
      } else {
        setCreateError(data.error || `Could not create workspace (${res.status}).`);
      }
    } catch (err) {
      console.error("Failed to create workspace", err);
      setCreateError('Network error — check the browser console and that the API is reachable.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-neutral-400" />
          Workspace
        </h2>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          {isCreating ? 'Cancel' : <><Plus className="w-3 h-3" /> Create New</>}
        </button>
      </div>

      {isCreating ? (
        <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {createError && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2">{createError}</p>
          )}
          <div className="flex gap-2 w-full">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="Enter workspace name..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-white/20 transition-colors"
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !newWorkspaceName.trim()}
            className="bg-white text-black px-4 py-2 rounded-xl text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => onWorkspaceSelect(ws.id)}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left ${
                selectedWorkspaceId === ws.id 
                  ? 'bg-white/10 border-white/30 ring-1 ring-white/20' 
                  : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]'
              }`}
            >
              <div>
                <div className="text-sm font-medium text-white">{ws.name}</div>
                <div className="text-[10px] text-neutral-500 mt-1">
                  Created {new Date(ws.created_at).toLocaleDateString()}
                </div>
              </div>
              {selectedWorkspaceId === ws.id && (
                <Check className="w-4 h-4 text-blue-400" />
              )}
            </button>
          ))}
          {workspaces.length === 0 && !isCreating && (
            <div className="col-span-2 py-8 text-center border border-dashed border-white/10 rounded-2xl">
              <p className="text-sm text-neutral-500">No workspaces found. Create one to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

