import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, File, AlertCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';
import useStore from '../store/useStore';

export default function UploadModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const fetchProjects = useStore((state) => state.fetchProjects);
  // We will just reload window for simplicity in hackathon, or handle gracefully in parent

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validate
    const valid = selectedFiles.filter(f => {
      const isPdfOrTxt = f.type === 'application/pdf' || f.type === 'text/plain' || f.name.endsWith('.txt');
      const isUnder10MB = f.size <= 10 * 1024 * 1024;
      return isPdfOrTxt && isUnder10MB;
    });

    if (valid.length !== selectedFiles.length) {
      setError("Some files were skipped. Only PDF and TXT under 10MB are allowed.");
    } else {
      setError(null);
    }

    if (files.length + valid.length > 5) {
      setError("Maximum 5 files allowed per investigation.");
      return;
    }

    setFiles([...files, ...valid]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || files.length === 0) {
      setError('Please provide a name, description, and at least one document.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    files.forEach(f => formData.append('files', f));

    try {
      await api.post('/api/projects/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Force reload to get fresh projects list and start streaming via selected project
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start investigation');
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-white">New Investigation</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Investigation Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Operation Shell Game"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-1">Context / Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are we looking for in these documents?"
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              />
            </div>

            {/* DRAG AND DROP ZONE */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">Source Documents (PDF / TXT)</label>
              <div 
                className="mt-1 border-2 border-dashed border-border rounded-2xl p-8 hover:bg-white/5 hover:border-accent/50 transition-colors cursor-pointer text-center flex flex-col items-center justify-center"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={32} className="text-muted mb-3" />
                <p className="text-sm text-white font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-muted mt-1">PDF or TXT up to 10MB each (max 5)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* FILE LIST */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-background border border-border p-3 rounded-lg">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <File size={16} className="text-accent shrink-0" />
                        <span className="text-sm text-white truncate">{file.name}</span>
                        <span className="text-xs text-muted shrink-0">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-muted hover:text-red-400 p-1">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border text-white hover:bg-white/5 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || files.length === 0 || !name || !description}
            className="flex items-center justify-center gap-2 bg-accent hover:bg-yellow-500 disabled:opacity-50 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            {isSubmitting ? (
              <><Loader2 size={18} className="animate-spin" /> Starting...</>
            ) : (
              'Start Investigation'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
