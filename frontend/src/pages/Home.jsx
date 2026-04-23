import React from 'react';
import Navbar from '../components/Navbar';
import DemoGraph from '../components/DemoGraph';
import { Upload, Network, ShieldAlert, Cpu } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative selection:bg-accent/30 selection:text-white">
      <Navbar />

      <main className="relative z-10">
        {/* HERO SECTION */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            Powered by 5 LangChain AI Agents
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6">
            Upload Documents. <br className="hidden md:block"/>
            Watch AI Uncover <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-400">Hidden Connections.</span>
          </h1>
          
          <p className="mt-4 max-w-2xl text-lg text-muted mx-auto mb-10">
            A multi-agent investigative journalism platform. Simply upload corporate filings, legal documents, or news articles, and watch as specialized AI agents build a live knowledge graph of entities and suspicious patterns.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/signup" className="px-8 py-4 w-full sm:w-auto text-base font-bold text-black bg-accent hover:bg-yellow-500 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all">
              Start Investigating Free
            </a>
            <a href="#how-it-works" className="px-8 py-4 w-full sm:w-auto text-base font-bold text-white bg-surface hover:bg-border border border-border rounded-xl transition-all">
              See How It Works
            </a>
          </div>
        </div>

        {/* DEMO GRAPH SECTION */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          <DemoGraph />
        </div>

        {/* FEATURES */}
        <div id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-border/50">
          <h2 className="text-3xl font-bold text-center text-white mb-16">The Investigative Pipeline</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface border border-border rounded-2xl p-8 hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-6">
                <Upload size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">1. intelligent Ingestion</h3>
              <p className="text-muted">Upload PDFs and TXTs. Our Ingestion Agent instantly classifies the document type and embeds its content via vector search for future verification.</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-8 hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 bg-accent/10 text-accent rounded-xl flex items-center justify-center mb-6">
                <Network size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">2. Live Graph Generation</h3>
              <p className="text-muted">The Entity Agent extracts people, organizations, and financial transactions, streaming them directly to your screen to build a real-time knowledge graph.</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-8 hover:border-accent/50 transition-colors">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center mb-6">
                <ShieldAlert size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">3. Pattern Detection</h3>
              <p className="text-muted">The Pattern Agent scans the complete graph for circular ownership, off-shore anomalies, and hidden intermediaries, highlighting suspicious links.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-12 text-center text-muted">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Cpu size={20} className="text-accent" />
          <span className="font-semibold text-white">InvestiGraph AI</span>
        </div>
        <p>Built with FastAPI, LangChain, React, and Supabase.</p>
      </footer>
    </div>
  );
}
