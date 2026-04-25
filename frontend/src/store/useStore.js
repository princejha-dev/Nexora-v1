import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../lib/api';

const useStore = create(
  persist(
    (set, get) => ({
  user: null,
  setUser: (user) => set({ user }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  fetchProjects: async () => {
    try {
      const res = await api.get('/api/projects');
      set({ projects: res.data });
    } catch (err) {
      console.error('fetchProjects failed:', err);
    }
  },

  activeProject: null,
  setActiveProject: (project) => set({ activeProject: project }),

  graphData: { nodes: [], links: [] },
  setGraphData: (data) => set({ graphData: data }),
  addNode: (node) => set((state) => {
    const exists = state.graphData.nodes.find(n => n.id === node.id);
    if (exists) return state;
    return { graphData: { ...state.graphData, nodes: [...state.graphData.nodes, node] } };
  }),
  addEdge: (edge) => set((state) => {
    // Basic deduplication
    const exists = state.graphData.links.find(e => 
      e.source === edge.source && e.target === edge.target && e.label === edge.label
    );
    if (exists) return state;
    return { graphData: { ...state.graphData, links: [...state.graphData.links, edge] } };
  }),

  agentMessages: {}, // Map of projectId -> array of messages
  addAgentMessage: (projectId, msg) => set((state) => ({ 
    agentMessages: {
      ...state.agentMessages,
      [projectId]: [...(state.agentMessages[projectId] || []), msg]
    } 
  })),
  clearAgentMessages: (projectId) => set((state) => ({ 
    agentMessages: {
      ...state.agentMessages,
      [projectId]: []
    }
  })),

  pipelineProgress: 0,
  setPipelineProgress: (val) => set({ pipelineProgress: val }),

  currentStage: {}, // Map of projectId -> currentStage
  setCurrentStage: (projectId, stage) => set((state) => ({ 
    currentStage: { ...state.currentStage, [projectId]: stage } 
  })),

  activeTab: 'graph',
  setActiveTab: (tab) => set({ activeTab: tab }),

  chatHistory: {},
  addChatMessage: (projectId, message) => set((state) => ({
    chatHistory: {
      ...state.chatHistory,
      [projectId]: [
        ...(state.chatHistory[projectId] || []),
        message
      ]
    }
  })),

  updateLastMessage: (projectId, content) => set((state) => {
    const history = state.chatHistory[projectId] || [];
    if (history.length === 0) return state;
    const updated = [...history];
    updated[updated.length - 1] = {
      ...updated[updated.length - 1],
      content
    };
    return {
      chatHistory: {
        ...state.chatHistory,
        [projectId]: updated
      }
    };
  }),

  clearChatHistory: (projectId) => set((state) => ({
    chatHistory: {
      ...state.chatHistory,
      [projectId]: []
    }
  })),

  projectFindings: {},
  setProjectFindings: (projectId, findings) => set((state) => ({
    projectFindings: { ...state.projectFindings, [projectId]: findings }
  })),

  projectNarratives: {},
  setProjectNarrative: (projectId, narrative) => set((state) => ({
    projectNarratives: { ...state.projectNarratives, [projectId]: narrative }
  })),
}), {
  name: 'nexora-storage',
  storage: createJSONStorage(() => localStorage),
  // Only persist history and messages, not ephemeral UI state
  partialize: (state) => ({ 
    chatHistory: state.chatHistory, 
    agentMessages: state.agentMessages,
    projectFindings: state.projectFindings,
    projectNarratives: state.projectNarratives,
    currentStage: state.currentStage
  }),
}));

export default useStore;
