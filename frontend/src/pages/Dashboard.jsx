import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import UploadModal from '../components/UploadModal';
import GraphCanvas from '../components/GraphCanvas';
import ChatPanel from '../components/ChatPanel';
import FindingsPanel from '../components/FindingsPanel';
import AgentStatus from '../components/AgentStatus';
import useStore from '../store/useStore';

export default function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const activeProject = useStore((state) => state.activeProject);
  const activeTab = useStore((state) => state.activeTab);
  const setActiveTab = useStore((state) => state.setActiveTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-white selection:bg-accent/30 selection:text-white">
      {/* LEFT SIDEBAR (Fixed Width) */}
      <Sidebar onNewProject={() => setIsUploadOpen(true)} />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
        
        {/* TABS HEADER */}
        {activeProject ? (
          <div className="h-14 bg-surface border-b border-border flex items-center px-6 shrink-0 z-10 w-full overflow-x-auto">
            <div className="flex space-x-8 h-full">
              {['graph', 'chat', 'findings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-full px-1 capitalize font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="ml-auto text-sm text-muted hidden sm:block truncate pl-4">
              {activeProject.name}
            </div>
          </div>
        ) : (
          <div className="h-14 bg-surface border-b border-border flex items-center px-6 shrink-0 z-10">
            <span className="text-muted text-sm">Select or create an investigation</span>
          </div>
        )}

        {/* WORKSPACE AREA */}
        <div className="flex-1 overflow-hidden flex w-full relative">
          
          {/* PRIMARY CONTENT / RENDERERS */}
          <div className="flex-1 min-w-0 overflow-hidden bg-background relative h-full">
            {!activeProject ? (
              <div className="h-full flex flex-col items-center justify-center text-muted">
                <p>Welcome to InvestiGraph.</p>
                <button 
                  onClick={() => setIsUploadOpen(true)}
                  className="mt-4 px-6 py-2 bg-white/5 border border-border rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  Create New Project
                </button>
              </div>
            ) : (
              <div className="w-full h-full overflow-hidden">
                {activeTab === 'graph' && <GraphCanvas />}
                {activeTab === 'chat' && <ChatPanel />}
                {activeTab === 'findings' && <FindingsPanel />}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: AGENT STATUS */}
          {activeProject && activeProject.status !== 'complete' && (
            <div className="w-[320px] shrink-0 bg-surface border-l border-border h-full flex flex-col z-10 hidden md:flex">
              <AgentStatus />
            </div>
          )}
        </div>
      </main>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </div>
  );
}
