import React, { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import useStore from '../store/useStore';
import api from '../lib/api';

const NODE_COLORS = {
  person:       '#facc15',
  organization: '#60a5fa',
  location:     '#34d399',
  financial:    '#f87171',
  date:         '#a78bfa',
  event:        '#fb923c'
};

export default function GraphCanvas() {
  const fgRef = useRef();
  const containerRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [dimensions, setDimensions] = useState({ 
    width: 800, height: 600 
  });
  
  // Ref to track if initial zoom is done
  const initialZoomDone = useRef(false);
  // Ref to track last background click time for double-click logic
  const lastBgClickTime = useRef(0);

  const graphData    = useStore(s => s.graphData);
  const setGraphData = useStore(s => s.setGraphData);
  const addNode      = useStore(s => s.addNode);
  const addEdge      = useStore(s => s.addEdge);
  const projectId    = useStore(s => s.activeProject?.id);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    // Set initial size immediately
    setDimensions({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!projectId) return;

    // Always clear graph when switching projects
    setGraphData({ nodes: [], links: [] });
    setSelectedNode(null);
    initialZoomDone.current = false;

    api.get(`/api/projects/${projectId}`)
      .then(res => {
        const status = res.data.status;

        if (status === 'complete') {
          // ── COMPLETED PROJECT ──────────────────────
          // Load all nodes and links from API at once.
          api.get(`/api/projects/${projectId}/graph`)
            .then(graphRes => {
              const nodes = (graphRes.data.entities || graphRes.data.nodes || [])
                .map(e => ({
                  id: e.id,
                  name: e.name,
                  type: e.type,
                  description: e.description || '',
                  suspicion_score: e.suspicion_score || 0,
                  color: NODE_COLORS[e.type] || '#ffffff',
                  val: (e.suspicion_score || 0) > 6 ? 2.5 : 1.2
                }));

              const links = (graphRes.data.relationships || graphRes.data.links || [])
                .map(r => ({
                  source: r.entity_a_id || r.source,
                  target: r.entity_b_id || r.target,
                  label: r.relation_label || r.label || ''
                }));

              // Set all at once — physics does the animation
              setGraphData({ nodes, links });

              // Auto fit after physics settles
              setTimeout(() => {
                fgRef.current?.zoomToFit(600, 80);
              }, 2000);
            });
        }
      })
      .catch(err => console.error('Project load error:', err));

    // Cleanup on project switch
    return () => {
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
    };
  }, [projectId, setGraphData]);

  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
    const fg = fgRef.current;

    // Strong repulsion keeps nodes spread apart
    fg.d3Force('charge')?.strength(-400);

    // Link distance controls spacing between connected nodes
    fg.d3Force('link')?.distance(140);

    // Center force keeps whole graph anchored to middle
    fg.d3Force('center')?.strength(0.4);

  }, [graphData.nodes.length]);

  const handleNodeClick = useCallback((node) => {
    // Pin every node in place so physics doesnt
    // push them around while we zoom
    graphData.nodes.forEach(n => {
      n.fx = n.x;
      n.fy = n.y;
    });

    setSelectedNode(node);

    // Zoom smoothly TO the node
    fgRef.current?.centerAt(node.x, node.y, 700);
    fgRef.current?.zoom(2.5, 700);
  }, [graphData.nodes]);

  const handleBackgroundClick = useCallback(() => {
    const now = Date.now();
    const timeSinceLastClick = now - lastBgClickTime.current;
    lastBgClickTime.current = now;

    // Unpin all nodes so physics can resume
    graphData.nodes.forEach(n => {
      n.fx = undefined;
      n.fy = undefined;
    });
    setSelectedNode(null);

    // If double clicked (within 300ms), zoom to fit
    if (timeSinceLastClick < 300) {
      fgRef.current?.zoomToFit(600, 80);
    }
  }, [graphData.nodes]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: '#030712' }}
    >
      {graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col 
                        items-center justify-center 
                        text-gray-600 pointer-events-none">
          <div className="text-4xl mb-3">🕸️</div>
          <p className="text-sm font-mono">
            waiting for entity extraction...
          </p>
        </div>
      )}

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{ 
          nodes: graphData.nodes, 
          links: graphData.links 
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          // Increase base radius by roughly 1.5x to make nodes bigger
          const radius = node.val ? 9 * node.val : 9;

          // Glow ring for suspicious nodes
          if ((node.suspicion_score || 0) > 6) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 7, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(248,113,113,0.25)';
            ctx.fill();
          }

          // Main filled circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = node.color || '#facc15';
          ctx.fill();

          // Subtle white border
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Label below node
          const fontSize = Math.min(14, 64 / globalScale);
          ctx.font = `bold ${fontSize}px Sans-Serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(node.name || '', node.x, node.y + radius + 4);
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          const radius = node.val ? 9 * node.val : 9;
          ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        linkColor={() => 'rgba(255,255,255,0.12)'}
        linkWidth={1.2}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalArrowColor={() => 'rgba(255,255,255,0.35)'}
        linkLabel={(link) => link.label || ''}
        onEngineStop={() => {
          // Only zoom out automatically the first time the physics settle
          if (!initialZoomDone.current) {
            fgRef.current?.zoomToFit(500, 80);
            initialZoomDone.current = true;
          }
        }}
        cooldownTicks={120}
        warmupTicks={20}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        enableNodeDrag={true}
        enableZoomInteraction={true}
      />

      {selectedNode && (
        <div className="absolute bottom-20 left-4 w-60 
                        bg-gray-900 border border-gray-700 
                        rounded-xl p-4 shadow-2xl z-20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: NODE_COLORS[selectedNode.type] || '#fff' }}>
              {selectedNode.type}
            </span>
            <button
              onClick={() => {
                setSelectedNode(null);
                handleBackgroundClick();
              }}
              className="text-gray-500 hover:text-white text-sm">
              ✕
            </button>
          </div>
          <p className="text-white font-bold text-sm mb-1">
            {selectedNode.name}
          </p>
          <p className="text-gray-400 text-xs mb-3 leading-relaxed">
            {selectedNode.description || 'No description available'}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">
              Suspicion Score
            </span>
            <span className={`text-xs font-bold px-2 py-1 rounded-full
              ${(selectedNode.suspicion_score || 0) > 6
                ? 'bg-red-900/60 text-red-300'
                : (selectedNode.suspicion_score || 0) > 3
                ? 'bg-yellow-900/60 text-yellow-300'
                : 'bg-gray-700 text-gray-300'}`}>
              {selectedNode.suspicion_score || 0}/10
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
