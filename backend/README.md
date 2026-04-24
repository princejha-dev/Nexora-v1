# 🔍 Nexora — Backend

FastAPI backend powering the Nexora investigative journalism platform. Runs a 6-stage LangChain multi-agent pipeline with RAG-powered document analysis and real-time graph construction.

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Framework | FastAPI | Async support, auto-docs, Pydantic validation |
| LLM | Groq (Llama 3.3 70B) | State-of-the-art reasoning, ultra-low latency |
| Embeddings | Google Gemini (text-embedding-004) | High dimensionality (768), semantic accuracy |
| Database | Supabase PostgreSQL + pgvector | Scalable vector search, free tier |
| Orchestration | LangChain | Robust agent chains and structured output |

## 🚀 Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Fill in your Groq API key, Google AI key, and Supabase credentials

# 3. Run the Supabase schema
# Go to Supabase Dashboard → SQL Editor → paste db/schema.sql → Run

# 4. Start the server
uvicorn main:app --reload --port 8000
```

## 📂 Project Structure

```
backend/
├── agents/              # AI agents (Ingestion, Entity, Pattern, Factcheck, Narrative)
├── api/                 # FastAPI route handlers
│   ├── auth.py          # JWT Authentication
│   ├── projects.py      # Project & Document management
│   ├── stream.py        # SSE endpoint for live telemetry
│   └── chat.py          # RAG-powered investigative chat
├── core/                # Core logic & infrastructure
│   ├── embedder.py      # Gemini Embedding integration
│   ├── parser.py        # PDF/TXT parsing + chunking
│   ├── vector_store.py  # pgvector search wrapper
│   └── orchestrator.py  # Pipeline coordinator
├── db/
│   ├── supabase.py      # DB client singleton
│   └── schema.sql       # Database schema
├── tests/               # pytest suite
└── main.py              # Application entry point
```

## 📡 API Endpoints

### Projects — `/api/projects`
- `POST /` : Create project & start pipeline (Multipart upload)
- `GET /` : List projects
- `GET /{id}/graph` : Fetch knowledge graph data
- `GET /{id}/findings` : Fetch detected anomalies
- `GET /stream/{id}` : Real-time SSE updates

### Investigative Chat — `/api/chat`
- `POST /{id}` : Chat with the investigation context (Streams response)

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Key for Llama 3.3 70B reasoning |
| `GOOGLE_API_KEY` | Key for Gemini Embeddings |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `JWT_SECRET` | Secret for signing auth tokens |
