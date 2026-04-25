import React, { useEffect, useRef } from 'react';

// Hardcoded demo graph data aligned with the directive
const nodesData = [
  { id: 1, name: 'Raj Mehta', type: 'person' },
  { id: 2, name: 'Offshore Holdings BVI', type: 'organization' },
  { id: 3, name: 'FastTrade Pvt Ltd', type: 'organization' },
  { id: 4, name: 'Swiss Account #447', type: 'financial' },
  { id: 5, name: 'Mumbai', type: 'location' },
  { id: 6, name: 'Contract 2023', type: 'date' },
  { id: 7, name: 'Shell Corp Cayman', type: 'organization' },
  { id: 8, name: 'Legal Firm XYZ', type: 'organization' }
];

const linksData = [
  { source: 1, target: 2, label: 'owns' },
  { source: 2, target: 7, label: 'owns' },
  { source: 3, target: 7, label: 'signed with' },
  { source: 3, target: 4, label: 'transfer to' },
  { source: 8, target: 2, label: 'represents' },
  { source: 8, target: 3, label: 'represents' },
  { source: 8, target: 7, label: 'represents' },
  { source: 1, target: 5, label: 'located in' },
  { source: 3, target: 6, label: 'dated' }
];

export default function DemoGraph() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set proper canvas resolution for retina displays
    const dpr = window.devicePixelRatio || 1;
    // Positioning logic (calculates relative to current cw/ch)
    const positionNodes = (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.35;
      
      nodesData.forEach((node, i) => {
        const angle = (i / nodesData.length) * Math.PI * 2 - Math.PI/2;
        node.x = cx + Math.cos(angle) * radius;
        node.y = cy + Math.sin(angle) * (radius * 0.8);
        node.score = [1,2,7].includes(node.id) ? 8 : 2; 
      });
    };

    const updateSize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      positionNodes(rect.width, rect.height);
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const activeNodes = [];
    const activeLinks = [];
    
    const colors = {
      person: '#facc15',
      organization: '#60a5fa',
      location: '#34d399',
      financial: '#f87171',
      date: '#a78bfa',
      event: '#fb923c',
    };

    let animationFrame;
    let nodeIndex = 0;
    let linkIndex = 0;
    let phase = 'nodes'; // 'nodes', 'links', 'stable'
    let time = 0;

    const draw = () => {
      time += 0.05;
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      const cx = cw / 2;
      const cy = ch / 2;
      ctx.clearRect(0, 0, cw, ch);

      // Recalculate positions if size changed (simple way to keep it centered)
      const radius = Math.min(cw, ch) * 0.35;
      nodesData.forEach((node, i) => {
        const angle = (i / nodesData.length) * Math.PI * 2 - Math.PI/2;
        node.x = cx + Math.cos(angle) * radius;
        node.y = cy + Math.sin(angle) * (radius * 0.8);
      });

      // Draw Links
      activeLinks.forEach(link => {
        const source = nodesData.find(n => n.id === link.source);
        const target = nodesData.find(n => n.id === link.target);
        
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = '#1f2937'; // var(--color-border)
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // simple arrow
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          ctx.fillStyle = '#6b7280';
          ctx.textAlign = 'center';
          ctx.font = '10px sans-serif';
          ctx.fillText(link.label, midX, midY - 4);
        }
      });

      // Draw Nodes
      activeNodes.forEach(node => {
        const c = colors[node.type] || '#fff';
        const isSuspicious = node.score > 5;
        const nodeRad = isSuspicious ? 12 : 8;

        // Glow
        if (isSuspicious) {
          const pulse = Math.sin(time * 2) * 5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRad + 5 + pulse, 0, 2 * Math.PI);
          ctx.fillStyle = c;
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRad, 0, 2 * Math.PI);
        ctx.fillStyle = c;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#f9fafb';
        ctx.textAlign = 'center';
        ctx.font = '12px sans-serif';
        ctx.fillText(node.name, node.x, node.y + nodeRad + 14);
      });

      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    const sequenceInterval = setInterval(() => {
      if (phase === 'nodes') {
        if (nodeIndex < nodesData.length) {
          activeNodes.push(nodesData[nodeIndex]);
          nodeIndex++;
        } else {
          phase = 'links';
        }
      } else if (phase === 'links') {
        if (linkIndex < linksData.length) {
          activeLinks.push(linksData[linkIndex]);
          linkIndex++;
        } else {
          phase = 'stable';
        }
      } else if (phase === 'stable') {
        // Reset and loop every 15s
        setTimeout(() => {
            activeNodes.length = 0;
            activeLinks.length = 0;
            nodeIndex = 0;
            linkIndex = 0;
            phase = 'nodes';
        }, 5000);
      }
    }, 600); // 600ms per element

    return () => {
      cancelAnimationFrame(animationFrame);
      clearInterval(sequenceInterval);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  return (
    <div className="w-full h-[500px] bg-[#030712] relative overflow-hidden flex flex-col items-center justify-center border border-border rounded-2xl shadow-xl">
      <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-surface border border-border rounded-full text-xs text-muted flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        Live Demo — Watch the graph build
      </div>
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}
