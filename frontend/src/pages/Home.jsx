import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DemoGraph from '../components/DemoGraph';
import { Upload, Network, ShieldAlert, Cpu, BadgeCheck, FileText, MessageSquare } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative selection:bg-accent/30 selection:text-white">
      <Navbar />

      <main className="relative z-10">
        {/* HERO SECTION */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-bold mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            The Future of Investigative Journalism
          </div>
          
          <h1 className="text-5xl md:text-8xl font-extrabold tracking-tight text-white mb-8 leading-[1.1]">
            Uncover the <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-orange-400 to-yellow-200">Invisible.</span><br/>
            Automate the <span className="text-muted/80">Search.</span>
          </h1>
          
          <p className="mt-4 max-w-3xl text-lg md:text-xl text-muted mx-auto mb-12 leading-relaxed">
            Nexora is a multi-agent orchestration platform that transforms leaked documents into interactive knowledge graphs. 
            Identify money laundering, circular ownership, and hidden corporate networks in seconds, not months.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/signup" className="px-10 py-5 w-full sm:w-auto text-lg font-bold text-black bg-accent hover:bg-yellow-500 rounded-2xl shadow-[0_0_30px_rgba(250,204,21,0.4)] transition-all transform hover:-translate-y-1">
              Start Free Investigation
            </Link>
            <a href="#agents" className="px-10 py-5 w-full sm:w-auto text-lg font-bold text-white bg-surface hover:bg-border border border-border rounded-2xl transition-all">
              Meet the Agents
            </a>
          </div>
        </div>

        {/* DEMO GRAPH SECTION */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-24 overflow-hidden">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 to-orange-500/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative h-[350px] md:h-[600px] w-full">
               <DemoGraph />
            </div>
          </div>
        </div>

        {/* AGENT GRID */}
        <div id="agents" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-border/50">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">A Specialized 6-Agent Pipeline</h2>
            <p className="text-muted text-lg max-w-2xl mx-auto">Each document undergoes a rigorous analysis by six autonomous agents, specialized in different stages of the investigative process.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Ingestion Agent', desc: 'Parses raw PDFs and TXTs, classifying document types and jurisdiction with high-precision Llama 3.3 70B logic.', icon: <Upload className="text-blue-400" />, color: 'blue' },
              { title: 'Entity Agent', desc: 'Extracts People, Organizations, and Financial links, streaming them live to build your interactive knowledge graph.', icon: <Network className="text-accent" />, color: 'yellow' },
              { title: 'Pattern Agent', desc: 'Detects circular ownership, shell companies, and suspicious financial timing across massive datasets.', icon: <ShieldAlert className="text-red-400" />, color: 'red' },
              { title: 'Factcheck Agent', desc: 'Uses Semantic RAG and Gemini Embeddings to verify every finding against the original source documents.', icon: <BadgeCheck className="text-green-400" />, color: 'green' },
              { title: 'Narrative Agent', desc: 'Synthesizes findings into structured investigative drafts, ready for editorial review and publishing.', icon: <FileText className="text-purple-400" />, color: 'purple' },
              { title: 'Chat Agent', desc: 'A conversational research assistant that knows your graph and documents. Ask anything, get sourced answers.', icon: <MessageSquare className="text-orange-400" />, color: 'orange' },
            ].map((agent, i) => (
              <div key={i} className="group bg-surface/50 backdrop-blur-sm border border-border rounded-3xl p-8 hover:border-accent/50 transition-all hover:shadow-2xl hover:shadow-accent/5">
                <div className={`w-14 h-14 bg-${agent.color}-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {agent.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{agent.title}</h3>
                <p className="text-muted leading-relaxed">{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-12 text-center text-muted">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Cpu size={20} className="text-accent" />
          <span className="font-semibold text-white">Nexora AI</span>
        </div>
        <p>Built with FastAPI, LangChain, React, and Supabase.</p>
      </footer>
    </div>
  );
}
