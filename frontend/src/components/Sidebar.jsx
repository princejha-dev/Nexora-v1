import React, { useEffect, useState } from 'react';
import { Search, Plus, FolderOpen, LogOut, ChevronRight } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import useStore from '../store/useStore';
import api from '../lib/api';

export default function Sidebar({ onNewProject }) {
  const { user, logout } = useAuth();
  const projects = useStore((state) => state.projects);
  const setProjects = useStore((state) => state.setProjects);
  const activeProject = useStore((state) => state.activeProject);
  const setActiveProject = useStore((state) => state.setActiveProject);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/api/projects/');
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProject(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    complete: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  const getStatusStyle = (status) => statusColors[status] || 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  return (
    <div className="w-[280px] h-full bg-surface border-r border-border flex flex-col pt-5 pb-4">
      {/* BRAND */}
      <div className="px-6 mb-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]">
          <Search className="text-accent" size={16} />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          InvestiGraph
        </span>
      </div>

      {/* NEW PROJECT BUTTON */}
      <div className="px-4 mb-6">
        <button
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-yellow-500 text-black font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-lg shadow-accent/10"
        >
          <Plus size={18} />
          <span>New Investigation</span>
        </button>
      </div>

      {/* PROJECT LIST */}
      <div className="px-4 text-xs font-semibold text-muted uppercase tracking-wider mb-3">
        Your Investigations
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {loading ? (
          <div className="text-muted text-sm px-3 italic">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-muted text-sm px-3 flex flex-col items-center justify-center py-10 opacity-60">
            <FolderOpen size={32} className="mb-2" />
            <p>No investigations yet.</p>
          </div>
        ) : (
          projects.map((proj) => (
            <button
              key={proj.id}
              onClick={() => setActiveProject(proj)}
              className={`w-full text-left px-3 py-3 rounded-xl transition-all border ${
                activeProject?.id === proj.id
                  ? 'bg-accent/10 border-accent/30 text-white'
                  : 'bg-transparent border-transparent text-muted hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="font-semibold truncate mb-1.5">{proj.name}</div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusStyle(proj.status)} uppercase font-bold tracking-wide`}>
                  {proj.status === 'complete' ? 'Done' : proj.status}
                </span>
                <span className="text-[11px] opacity-70">
                  {proj.entity_count} nodes
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* FOOTER / USER */}
      <div className="px-4 mt-auto pt-4 border-t border-border">
        <div className="flex items-center justify-between bg-black/20 p-2 pl-3 rounded-xl border border-border">
          <div className="truncate pr-2">
            <div className="text-sm font-medium text-white truncate">{user?.email?.split('@')[0]}</div>
            <div className="text-xs text-muted truncate">{user?.email}</div>
          </div>
          <button 
            onClick={logout}
            title="Sign Out"
            className="p-2 text-muted hover:text-red-400 hover:bg-black/40 rounded-lg transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
