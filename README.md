# 🛰️ Nexora

**Nexora** is an AI-powered investigative journalism platform designed to uncover hidden connections, financial patterns, and corporate networks from raw documents. Using a multi-agent orchestration pipeline, Nexora transforms leaked PDFs and memos into an interactive knowledge graph, providing journalists with automated summaries, anomaly detection, and a conversational research assistant.

---

## 🌟 Key Features

- **Live Multi-Agent Pipeline**: Watch AI agents process documents in real-time (Ingestion → Embedding → Extraction → Pattern Analysis → Fact-checking).
- **Interactive Knowledge Graph**: Explore entities (People, Organizations, Locations) and their relationships with dynamic scaling and physics.
- **Agentic Chat**: Query your investigation using a streaming chat interface that understands the context of your graph.
- **Automated Narrative Generation**: Generate investigative drafts and summary reports automatically from discovered findings.
- **Real-time Telemetry**: A live "terminal" side-panel showing agent logs as they work.

---

## 🛠️ Technology Stack

- **Frontend**: React, Zustand (State Management), Force-Graph-2D (Visualization), Tailwind CSS.
- **Backend**: FastAPI (Python), LangChain (Agent Orchestration), Pydantic.
- **LLMs**: Groq (Llama 3.3 70B for extraction/reasoning), Google Gemini (Embeddings).
- **Database**: Supabase (PostgreSQL + Vector Store).
- **Deployment**: Render (Backend), Vercel (Frontend).

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- Groq API Key
- Google AI API Key (for Gemini)

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```
Create a `.env` file in the `backend` folder:
```env
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
GROQ_API_KEY=your_groq_key
GOOGLE_API_KEY=your_google_key
JWT_SECRET=your_secret
```
Run the server:
```bash
uvicorn main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
Create a `.env` file in the `frontend` folder:
```env
VITE_API_URL=http://localhost:8000
```
Run the development server:
```bash
npm run dev
```

---

## 📦 Deployment

### Backend (Render)
1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Set the build command to: `pip install -r requirements.txt` (or use the provided `Dockerfile`).
4. Set the start command to: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. Add all environment variables from your `.env`.

### Frontend (Vercel)
1. Import your project into Vercel.
2. Set the framework to **Vite**.
3. Set the **Root Directory** to `frontend`.
4. Add the `VITE_API_URL` environment variable pointing to your Render backend URL.

---

## 📜 License
MIT License - Developed for the HiDevs Hackathon.
