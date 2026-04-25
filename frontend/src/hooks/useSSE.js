import { useEffect, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import useStore from '../store/useStore';
import api from '../lib/api';

const NODE_COLORS = {
  person: '#facc15',
  organization: '#60a5fa',
  location: '#34d399',
  financial: '#f87171',
  date: '#a78bfa',
  event: '#fb923c'
};

export default function useSSE(projectId) {
  const addNode = useStore((state) => state.addNode);
  const addEdge = useStore((state) => state.addEdge);
  const addAgentMessage = useStore((state) => state.addAgentMessage);
  const setPipelineProgress = useStore((state) => state.setPipelineProgress);
  const setCurrentStage = useStore((state) => state.setCurrentStage);
  const fetchProjects = useStore((state) => state.fetchProjects);
  
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;

    // Fast-fail if there's already an active connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const token = localStorage.getItem('token');
    if (!token) return;

    const streamUrl = `${api.defaults.baseURL || 'http://localhost:8000'}/api/stream/${projectId}`;

    fetchEventSource(streamUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: abortControllerRef.current.signal,
      async onopen(res) {
        if (res.ok && res.status === 200) {
          console.log('SSE Pipeline Connected');
        } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error('Fatal SSE Error');
        }
      },
      onmessage(event) {
        let msg = {};
        try {
          if (event.data) msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }

        switch (event.event) {
          case 'progress':
            if (msg.percent !== undefined) setPipelineProgress(msg.percent);
            break;
            
          case 'status':
            if (msg.stage) setCurrentStage(projectId, msg.stage);
            if (msg.message) addAgentMessage(projectId, { agent: 'system', message: msg.message, timestamp: new Date() });
            break;
            
          case 'message':
            addAgentMessage(projectId, { agent: msg.agent, message: msg.message, timestamp: new Date() });
            break;
            
          case 'node':
            addNode({
              id: msg.id,
              name: msg.name,
              type: msg.type,
              description: msg.description,
              suspicion_score: msg.suspicion_score,
              color: NODE_COLORS[msg.type] || '#ffffff',
              val: msg.suspicion_score > 6 ? 3 : 1
            });
            break;
            
          case 'edge':
            addEdge({
              source: msg.source,
              target: msg.target,
              label: msg.label
            });
            break;

          case 'alert':
            addAgentMessage(projectId, { 
              agent: 'pattern', 
              message: `ALERT: ${msg.pattern} - ${msg.description}`, 
              isAlert: true,
              timestamp: new Date()
            });
            break;

          case 'complete':
            fetchProjects(); // refresh projects to show complete state
            setCurrentStage(projectId, 'Verification Complete');
            setPipelineProgress(100);
            if (msg.message) addAgentMessage(projectId, { agent: 'system', message: msg.message, timestamp: new Date() });
            break;

          case 'error':
            addAgentMessage(projectId, { 
              agent: 'system', 
              message: `ERROR: ${msg.message}`, 
              isAlert: true,
              timestamp: new Date()
            });
            break;

          case 'ping':
            // just to keep connection alive
            break;
            
          default:
            console.log('Unknown event:', event.event, msg);
        }
      },
      onclose() {
        console.log('SSE Pipeline Closed');
      },
      onerror(err) {
        console.error('SSE Error:', err);
        // Throwing error stops retries for fetchEventSource
        if (err instanceof Error) throw err;
      }
    });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [projectId]); 

}
