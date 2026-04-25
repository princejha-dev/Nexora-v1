import React, { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { Cpu, Terminal, ShieldAlert, X } from 'lucide-react';
import useSSE from '../hooks/useSSE';

export default function AgentStatus({ onClose }) {
  const activeProject = useStore((state) => state.activeProject);
  const allMessages = useStore((state) => state.agentMessages);
  const allStages = useStore((state) => state.currentStage);
  const pipelineProgress = useStore((state) => state.pipelineProgress);

  const agentMessages = activeProject ? (allMessages[activeProject.id] || []) : [];
  const currentStage = activeProject ? (allStages[activeProject.id] || '') : '';
  
  const endOfMessagesRef = useRef(null);

  // Initialize SSE for the active project
  useSSE(activeProject?.id);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  if (!activeProject) return null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* HEADER & PROGRESS */}
      <div className="p-4 border-b border-border bg-surface shrink-0 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-accent flex items-center gap-2 mb-1">
            <Terminal size={18} />
            Terminal Output
          </h3>
          <p className="text-[10px] text-muted uppercase tracking-widest font-bold">Real-time Telemetry</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-muted hover:text-white transition-colors"
            title="Close Terminal"
          >
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* PROGRESS BAR */}
      <div className="px-4 py-3 bg-black/20 border-b border-border">
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-white capitalize">{currentStage || 'Initializing Pipeline...'}</span>
            <span className="text-muted">{pipelineProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-background border border-border overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${pipelineProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* MESSAGES LOG */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {agentMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted flex-col opacity-50">
            <Cpu size={32} className="mb-2" />
            {activeProject.status === 'complete' ? (
              <span className="text-center px-4">Investigation logs archived. Pipeline summary available in Findings tab.</span>
            ) : (
              <span>Awaiting telemetry...</span>
            )}
          </div>
        ) : (
          agentMessages.map((msg, i) => (
            <div key={i} className={`p-3 rounded-lg border flex flex-col gap-1 ${
              msg.isAlert 
                ? 'bg-red-500/10 border-red-500/30 text-red-100' 
                : 'bg-black/40 border-border text-gray-300'
            }`}>
              <div className="flex items-center justify-between opacity-80 mb-1">
                <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${msg.isAlert ? 'text-red-400' : 'text-accent'}`}>
                  {msg.isAlert ? <ShieldAlert size={14} /> : <Cpu size={14} />}
                  [{msg.agent}]
                </div>
                <div className="text-[10px] text-muted">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                </div>
              </div>
              <div className="break-words leading-relaxed pl-1">
                {msg.message}
              </div>
            </div>
          ))
        )}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
}
