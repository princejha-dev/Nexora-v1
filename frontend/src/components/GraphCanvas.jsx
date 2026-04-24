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
      graphRef.current.d3Force('charge').strength(-500);
      graphRef.current.d3Force('link').distance(150);
      // Center force keeps graph anchored to middle
      graphRef.current.d3Force('center')?.strength(0.3);
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
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx) => {
            const label = link.label || link.relation_label;
            if (!label) return;
            const start = link.source;
            const end = link.target;
            if (typeof start !== 'object' || typeof end !== 'object') return;
            
            const textPos = {
              x: start.x + (end.x - start.x) / 2,
              y: start.y + (end.y - start.y) / 2
            };
            
            const relLink = { x: end.x - start.x, y: end.y - start.y };
            let textAngle = Math.atan2(relLink.y, relLink.x);
            if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
            if (textAngle < -Math.PI / 2) textAngle = -(Math.PI + textAngle);
            
            const fontSize = 10;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.save();
            ctx.translate(textPos.x, textPos.y);
            ctx.rotate(textAngle);
            
            // Background to make text readable over lines
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(3, 7, 18, 0.8)';
            ctx.fillRect(-textWidth / 2 - 2, -fontSize / 2 - 2, textWidth + 4, fontSize + 4);
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(label, 0, 0);
            ctx.restore();
          }}
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
          <p className="text-gray-400 text-xs mb-3">
            {selectedNode.description || 'No description available'}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Suspicion Score</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              selectedNode.suspicion_score > 6 ? 'bg-red-900 text-red-300' : 
              selectedNode.suspicion_score > 3 ? 'bg-yellow-900 text-yellow-300' : 
              'bg-gray-700 text-gray-300'
            }`}>
              {selectedNode.suspicion_score || 0}/10
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
