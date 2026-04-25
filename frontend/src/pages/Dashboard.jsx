import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import UploadModal from '../components/UploadModal';
import GraphCanvas from '../components/GraphCanvas';
import ChatPanel from '../components/ChatPanel';
import FindingsPanel from '../components/FindingsPanel';
import AgentStatus from '../components/AgentStatus';
import useStore from '../store/useStore';
import { Menu, X, Terminal as TerminalIcon } from 'lucide-react';

export default function Dashboard() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const activeProject = useStore((state) => state.activeProject);
  const activeTab = useStore((state) => state.activeTab);
  const setActiveTab = useStore((state) => state.setActiveTab);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);

  // Automatically show terminal when a new project starts
  React.useEffect(() => {
    if (activeProject && activeProject.status !== 'complete') {
      setIsTerminalVisible(true);
    }
  }, [activeProject?.id, activeProject?.status]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background text-white selection:bg-accent/30 selection:text-white relative">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden h-14 bg-surface/90 backdrop-blur-md border-b border-border flex items-center px-4 shrink-0 z-50 justify-between sticky top-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 hover:bg-white/5 rounded-lg text-accent"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <span className="font-bold text-accent tracking-tight">Nexora</span>
        </div>
        
        {activeProject && (
          <div className="flex-1 px-4 truncate text-center text-xs text-muted font-medium">
            {activeProject.name}
          </div>
        )}

        <div className="flex items-center gap-1">
          {activeProject && (
            <button 
              onClick={() => setIsTerminalVisible(!isTerminalVisible)}
              className={`p-2 rounded-lg transition-colors ${isTerminalVisible ? 'text-accent bg-accent/10' : 'text-muted hover:text-white'}`}
              title="Toggle Terminal"
            >
              <TerminalIcon size={20} />
            </button>
          )}
        </div>
      </div>

      {/* LEFT SIDEBAR */}
      <div className={`
        fixed md:relative z-40 h-full transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar 
          onClose={() => setIsSidebarOpen(false)}
          onNewProject={() => {
            setIsUploadOpen(true);
            setIsSidebarOpen(false);
          }} 
        />
      </div>

      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden flex flex-col relative w-full h-full">
        
        {/* TABS HEADER */}
        {activeProject ? (
          <div className="h-14 bg-surface border-b border-border flex items-center px-4 md:px-6 shrink-0 z-10 w-full overflow-x-auto no-scrollbar">
            <div className="flex space-x-4 md:space-x-8 h-full">
              {['graph', 'chat', 'findings'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-full px-1 capitalize font-semibold border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${
                    activeTab === tab
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="ml-auto text-xs md:text-sm text-muted truncate pl-4">
              {activeProject.name}
            </div>
          </div>
        ) : (
          <div className="h-14 bg-surface border-b border-border flex items-center px-6 shrink-0 z-10">
            <span className="text-muted text-sm">Select or create an investigation</span>
          </div>
        )}

        {/* WORKSPACE AREA */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row w-full relative">
          
          {/* PRIMARY CONTENT / RENDERERS */}
          <div className="flex-1 min-w-0 overflow-hidden bg-background relative h-full">
            {!activeProject ? (
              <div className="h-full flex flex-col items-center justify-center text-muted p-6 text-center">
                <p>Welcome to Nexora AI.</p>
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

          {/* RIGHT SIDEBAR: AGENT STATUS (TERMINAL) */}
          {activeProject && isTerminalVisible && (
            <div className={`
              fixed md:relative bottom-0 right-0 w-full md:w-[320px] lg:w-[380px] shrink-0 bg-surface border-l border-border 
              h-[40vh] md:h-full flex flex-col z-20 shadow-2xl md:shadow-none transition-all duration-300
              ${activeProject.status === 'complete' && 'opacity-90'}
            `}>
              <AgentStatus onClose={() => setIsTerminalVisible(false)} />
            </div>
          )}
        </div>
      </main>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </div>
  );
}
