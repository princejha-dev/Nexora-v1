import React, { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import api from '../lib/api';
import { Send, User, Bot, Loader2 } from 'lucide-react';

export default function ChatPanel() {
  const activeProject = useStore((state) => state.activeProject);
  const chatHistory = useStore((state) => state.chatHistory);
  const addChatMessage = useStore((state) => state.addChatMessage);
  const updateLastMessage = useStore((state) => state.updateLastMessage);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const messages = (activeProject && chatHistory[activeProject.id]) ? chatHistory[activeProject.id] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!activeProject) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeProject?.id) return;
    
    const userMsg = { role: 'user', content: input.trim() };
    addChatMessage(activeProject.id, userMsg);
    const currentInput = input.trim();
    setInput('');
    setLoading(true);
    
    // Add empty assistant message to stream into
    const assistantMsg = { role: 'ai', content: '' };
    addChatMessage(activeProject.id, assistantMsg);
    
    // We'll track the concatenated text here so we can update the store
    let currentResponse = '';
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${api.defaults.baseURL || 'http://localhost:8000'}/api/chat/${activeProject.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: currentInput })
        }
      );

      // Handle SSE streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            if (data) {
              // Append each chunk to last message
              currentResponse += data;
              updateLastMessage(activeProject.id, currentResponse);
            }
          }
        }
      }
    } catch (err) {
      updateLastMessage(activeProject.id, 'Failed to get response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto border-x border-border bg-[#0a0a0a]">
      {/* HEADER */}
      <div className="p-4 border-b border-border bg-surface shrink-0 flex flex-col justify-center">
        <h2 className="text-lg font-bold text-white">Investigation Assistant</h2>
        <p className="text-xs text-muted mt-1">Ask questions about the findings and underlying document context.</p>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
            <Bot size={48} className="opacity-50" />
            <p>I am the Investigation RAG Assistant.</p>
            <p className="text-sm">Ask me to summarize documents, find specific transactions, or search for entities.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-accent" />
                </div>
              )}

              <div className={`px-5 py-3.5 rounded-2xl max-w-[85%] shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-accent text-black font-medium leading-relaxed' 
                  : 'bg-surface border border-border text-gray-200'
              }`}>
                {msg.role === 'ai' ? (
                  <div className="text-sm leading-relaxed space-y-2">
                    {msg.content
                      .split('\n')
                      .filter(line => line !== undefined)
                      .map((line, i) => {
                        if (line.trim() === '') return (
                          <div key={i} className="h-2" />
                        );
                        if (line.trim().startsWith('- ')) return (
                          <div key={i} className="flex gap-2">
                            <span className="text-yellow-400 mt-0.5">•</span>
                            <span>{line.trim().slice(2)}</span>
                          </div>
                        );
                        return <p key={i}>{line}</p>;
                      })
                    }
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
              <Bot size={16} className="text-accent animate-pulse" />
            </div>
            <div className="px-5 py-3.5 rounded-2xl bg-surface border border-border text-muted flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Retrieving context...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 border-t border-border bg-surface">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Explain the relationship between Offshore Holdings and Raj Mehta..."
            className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-4 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-medium"
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="absolute right-2 p-2 bg-accent/20 hover:bg-accent hover:text-black text-accent rounded-lg transition-all disabled:opacity-50 disabled:hover:bg-accent/20 disabled:hover:text-accent"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
