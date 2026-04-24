import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import useStore from '../store/useStore';
import api from '../lib/api';

const COLORS = {
  person: '#facc15',
  organization: '#3b82f6',
  date: '#a855f7',
  event: '#f97316',
  location: '#22c55e',
  financial: '#ef4444'
};

export default function GraphCanvas() {
  const activeProject = useStore((state) => state.activeProject);
  const graphData = useStore((state) => state.graphData);
  const setGraphData = useStore((state) => state.setGraphData);
  const addNode = useStore((state) => state.addNode);
  const addEdge = useStore((state) => state.addEdge);
  const graphRef = useRef();
  const containerRef = useRef();

  const [selectedNode, setSelectedNode] = useState(null);
  const initialZoomDone = useRef(false);

  // On mount and project change, try to pre-fetch existing graph data from DB if available
  useEffect(() => {
    if (!activeProject?.id) return;
    
    // Clear graph when switching projects
    initialZoomDone.current = false;
    setGraphData({ nodes: [], links: [] });

    // Fetch the project status first
    api.get(`/api/projects/${activeProject.id}`)
      .then(res => {
        const status = res.data.status;
        
        if (status === 'complete') {
          // COMPLETED PROJECT: load all at once
          // then trigger explosion animation
          api.get(`/api/projects/${activeProject.id}/graph`)
            .then(graphRes => {
              const nodes = (graphRes.data.nodes || []).map(e => ({
                id: e.id,
                name: e.name,
                type: e.type,
                description: e.description,
                suspicion_score: e.suspicion_score || 0,
                color: COLORS[e.type] || '#ffffff',
                val: (e.suspicion_score || 0) > 6 ? 3 : 1
              }));
              const links = (graphRes.data.links || []).map(r => ({
                source: r.source,
                target: r.target,
                label: r.label
              }));
              // Set ALL at once — force graph physics
              // creates the natural explosion/settle animation
              setGraphData({ nodes, links });
            })
            .catch(err => console.log('Graph fetch error', err));
        }
        // If status is not complete, SSE streaming handles it
        // via useSSE hook — do nothing here for active pipelines
      })
      .catch(err => console.log('Project fetch error', err));
  }, [activeProject?.id, setGraphData]);

  // Handle Resize correctly for react-force-graph using ResizeObserver
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      // Force re-render to pick up new dimensions
      if (graphRef.current) {
        graphRef.current.zoomToFit(400, 60);
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Stronger repulsion so nodes spread out more
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge').strength(-150);
      graphRef.current.d3Force('link').distance(100);
      // Center force keeps graph anchored to middle
      graphRef.current.d3Force('center')?.strength(0.5);
    }
  }, [graphData.nodes.length]);

  if (!activeProject) return null;

  return (
    <div ref={containerRef} className="flex-1 w-full h-full relative" style={{ background: '#030712' }}>
      {graphData.nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted font-mono z-10 pointer-events-none">
          waiting for entity extraction...
        </div>
      ) : (
        <ForceGraph2D
          ref={graphRef}
          width={containerRef.current?.clientWidth || 800}
          height={containerRef.current?.clientHeight || 600}
          graphData={{ 
            nodes: graphData.nodes, 
            links: graphData.links 
          }}
          cooldownTicks={150}
          d3AlphaDecay={0.01}
          d3VelocityDecay={0.2}
          warmupTicks={30}
          onEngineStop={() => {
            if (!initialZoomDone.current) {
              graphRef.current?.zoomToFit(600, 80);
              initialZoomDone.current = true;
            }
          }}
          nodeLabel="name"
          nodeColor={node => COLORS[node.type] || '#ffffff'}
          nodeRelSize={6}
          linkColor={() => 'rgba(255,255,255,0.15)'}
          linkWidth={1.5}
          linkLabel={(link) => link.label || link.relation_label || ''}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalArrowColor={() => 'rgba(255,255,255,0.4)'}
          onNodeClick={(node) => {
            // Pin ALL nodes in place before zooming
            // so physics doesnt push them around
            graphData.nodes.forEach(n => {
              n.fx = n.x;
              n.fy = n.y;
            });

            setSelectedNode(node);

            // Smooth zoom TO the node not away from it
            graphRef.current?.centerAt(node.x, node.y, 800);
            graphRef.current?.zoom(2.5, 800);
          }}
          onBackgroundClick={() => {
            // Unpin all nodes so physics resumes
            graphData.nodes.forEach(n => {
              n.fx = undefined;
              n.fy = undefined;
            });
            setSelectedNode(null);
            graphRef.current?.zoomToFit(600, 80);
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            const radius = node.val ? 10 + (node.val * 3) : 10;
            ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
            ctx.fill();
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            // Node radius that scales naturally with zoom
            const radius = node.val ? 10 + (node.val * 3) : 10;

            // Glow effect for high suspicion nodes
            if ((node.suspicion_score || 0) > 6) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
              ctx.fillStyle = 'rgba(248, 113, 113, 0.2)';
              ctx.fill();
            }

            // Main circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = node.color || '#facc15';
            ctx.fill();

            // White border
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label — Fixed internal size so it scales properly alongside the node
            const label = node.name || '';
            const fontSize = 12;
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, node.x, node.y + radius + 4);
          }}
        />
      )}

      {/* LEGEND overlay */}
      <div className="absolute bottom-4 left-4 bg-surface/80 backdrop-blur-md px-4 py-3 rounded-xl border border-border text-xs flex gap-4">
        {Object.entries(COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
            <span className="text-white capitalize font-medium">{type}</span>
          </div>
        ))}
      </div>

      {selectedNode && (
        <div className="absolute bottom-20 left-4 bg-gray-900 border border-gray-700 rounded-xl p-4 w-64 z-10 shadow-xl">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold uppercase tracking-wider"
                  style={{color: COLORS[selectedNode.type] || '#fff'}}>
              {selectedNode.type}
            </span>
            <button onClick={() => setSelectedNode(null)}
                    className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>
          <h3 className="text-white font-bold text-sm mb-1">
            {selectedNode.name}
          </h3>
          <p className="text-gray-400 text-xs mb-1">
            {selectedNode.description || 'No description available'}
          </p>
        </div>
      )}
    </div>
  );
}
