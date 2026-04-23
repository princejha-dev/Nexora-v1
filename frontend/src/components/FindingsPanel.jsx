import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import api from '../lib/api';
import { FileText, Loader2, RefreshCw, TriangleAlert, ShieldAlert, BadgeInfo } from 'lucide-react';

export default function FindingsPanel() {
  const activeProject = useStore((state) => state.activeProject);
  const [findings, setFindings] = useState([]);
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeProject) fetchData();
  }, [activeProject]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [findRes, projRes] = await Promise.all([
        api.get(`/api/projects/${activeProject.id}/findings`),
        api.get(`/api/projects/${activeProject.id}`)
      ]);
      setFindings(findRes.data);
      // Backend should store narrative in project record or findings table. Right now, narrative is generated on demand.
    } catch (err) {
      console.error(err);
      setError("Failed to load findings.");
    } finally {
      setLoading(false);
    }
  };

  const generateNarrative = async () => {
    setGeneratingDraft(true);
    try {
      const { data } = await api.post(`/api/agents/narrative/${activeProject.id}`);
      setNarrative(data.draft);
    } catch (err) {
      setError("Failed to generate narrative draft.");
    } finally {
      setGeneratingDraft(false);
    }
  };

  if (!activeProject) return null;

  return (
    <div className="flex w-full h-full bg-[#0a0a0a] overflow-hidden">
      {/* LEFT COL: RAW PATTERN FINDINGS LIST */}
      <div className="w-[45%] h-full border-r border-border flex flex-col">
        <div className="p-5 border-b border-border bg-surface shrink-0 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert size={20} className="text-red-400" /> Detected Anomalies
          </h2>
          <button onClick={fetchData} className="p-1.5 text-muted hover:text-white rounded-md bg-white/5 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-muted flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading findings...</div>
          ) : findings.length === 0 ? (
            <div className="text-center p-8 bg-surface border border-border rounded-xl text-muted">
              <BadgeInfo size={32} className="mx-auto mb-3 opacity-50" />
              <p>No suspicious patterns detected yet or the pipeline is still analyzing.</p>
            </div>
          ) : (
            findings.map(finding => (
              <div key={finding.id} className="bg-surface border border-border rounded-xl p-4 transition-all hover:border-red-500/50">
                <div className="flex justify-between items-start mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30">
                    <TriangleAlert size={10} /> 
                    {finding.pattern_type}
                  </span>
                  <span className="text-xs font-mono text-muted bg-black/40 px-2 py-1 rounded">
                    Score: {finding.suspicion_score}/10
                  </span>
                </div>
                <h3 className="text-white font-semibold text-sm leading-snug mb-2">{finding.description}</h3>
                {finding.evidence_links && finding.evidence_links.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border border-dashed text-xs text-muted flex gap-2">
                    <span className="font-semibold text-gray-400">Entities Involved:</span>
                    <span className="truncate">{finding.evidence_links.join(', ')}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COL: JOURNALIST NARRATIVE DRAFT */}
      <div className="flex-1 h-full flex flex-col bg-[#050505]">
        <div className="p-5 border-b border-border bg-surface shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText size={20} className="text-accent" /> Journalist Draft
            </h2>
            <p className="text-xs text-muted mt-0.5">Synthesized article ready for editorial review</p>
          </div>
          <button 
            onClick={generateNarrative} 
            disabled={generatingDraft || findings.length === 0}
            className="flex items-center gap-2 bg-accent hover:bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:hover:bg-accent"
          >
            {generatingDraft ? <><Loader2 size={16} className="animate-spin"/> Summarizing...</> : 'Generate Draft'}
          </button>
        </div>

        <div className="flex-1 p-8 overflow-y-auto font-serif text-lg leading-relaxed text-gray-200">
          {error && <div className="p-4 bg-red-500/10 text-red-400 rounded-lg border border-red-500/30 mb-6 text-sm">{error}</div>}
          
          {generatingDraft ? (
             <div className="h-full flex flex-col items-center justify-center text-muted font-sans space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-accent/20 rounded-full"></div>
                  <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                </div>
                <p>LLaMA 3.1 70B is analyzing findings and structuring the draft narrative...</p>
             </div>
          ) : narrative ? (
            <div className="prose prose-invert prose-yellow max-w-none">
               {/* Extremely simple markdown parser for bold/italics could go here, or just whitespace-pre-wrap */}
               <div className="whitespace-pre-wrap">{narrative}</div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted font-sans text-center max-w-sm mx-auto opacity-60">
              <FileText size={48} className="mb-4 text-accent drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
              <p>Click "Generate Draft" to compile all extracted evidence and anomalies into a structured investigative article.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
