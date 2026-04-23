# InvestiGraph AI — Backend Setup Guide

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager
- A [Groq](https://console.groq.com) account (free)
- A [Supabase](https://supabase.com) project (free tier)

---

## Step 1: Install Dependencies

```bash
cd backend
uv venv
# Activate the venv:
# Windows:
.venv\Scripts\activate
# Linux/Mac:
# source .venv/bin/activate

uv pip install -r requirements.txt
```

> **Note:** First run will download the HuggingFace embedding model (~80MB). Needs internet.

---

## Step 2: Set Up Supabase

### 2.1 Create a Supabase Project
1. Go to https://supabase.com → New Project
2. Pick a name, set a DB password, choose a region

### 2.2 Run the Database Schema
1. Go to **SQL Editor** in Supabase Dashboard
2. Copy the entire contents of `db/schema.sql`
3. Paste and click **Run**
4. You should see all tables created: `projects`, `documents`, `chunks`, `entities`, `relationships`, `findings`

### 2.3 Get Your Keys
Go to **Settings → API** in your Supabase Dashboard:
- `SUPABASE_URL` → the Project URL
- `SUPABASE_ANON_KEY` → the `anon` `public` key
- `SUPABASE_SERVICE_KEY` → the `service_role` key (click "Reveal")

---

## Step 3: Get Groq API Key

1. Go to https://console.groq.com/keys
2. Create a new API key
3. Copy it — this is your `GROQ_API_KEY`

Free tier: 14,400 requests/day (more than enough)

---

## Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
JWT_SECRET=any-random-long-string-at-least-32-chars
FRONTEND_URL=http://localhost:5173
```

---

## Step 5: Test Core Modules

### 5.1 Test Embedder (verifies HuggingFace model loads)
```bash
cd backend
python -c "from core.embedder import embed_query; v = embed_query('test'); print(f'OK: {len(v)} dimensions')"
```
Expected output: `OK: 384 dimensions`

### 5.2 Test Parser
```bash
python -c "from core.parser import chunk_text; c = chunk_text('Hello world. ' * 200); print(f'OK: {len(c)} chunks')"
```

### 5.3 Test Supabase Connection
```bash
python -c "from db.supabase import supabase; print('Supabase connected:', supabase.table('projects').select('id').limit(1).execute())"
```

### 5.4 Test Groq LLM
```bash
python -c "
from langchain_groq import ChatGroq
from config import get_settings
llm = ChatGroq(model_name='llama-3.1-8b-instant', api_key=get_settings().GROQ_API_KEY)
r = llm.invoke('Say hello in 3 words')
print('Groq OK:', r.content)
"
```

---

## Step 6: Start the Server

```bash
uvicorn main:app --reload --port 8000
```

Server starts at: http://localhost:8000

Check health: http://localhost:8000/health

Expected response:
```json
{"status": "healthy", "model": "sentence-transformers/all-MiniLM-L6-v2", "embedding_dim": 384}
```

API docs (auto-generated): http://localhost:8000/docs

---

## Step 7: Test API Endpoints

### 7.1 Register a User
```bash
curl -X POST http://localhost:8000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"test@example.com\", \"password\": \"password123\"}"
```

Response:
```json
{"access_token": "eyJ...", "token_type": "bearer", "user_id": "uuid"}
```

Save the `access_token` for next requests.

### 7.2 Login
```bash
curl -X POST http://localhost:8000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"test@example.com\", \"password\": \"password123\"}"
```

### 7.3 Check Auth
```bash
curl http://localhost:8000/api/auth/me ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7.4 Create a Project (Upload Files)
```bash
curl -X POST http://localhost:8000/api/projects/ ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -F "name=Test Investigation" ^
  -F "description=Analyzing sample documents for connections" ^
  -F "files=@sample.pdf" ^
  -F "files=@sample.txt"
```

This starts the 5-agent pipeline in the background. Response:
```json
{"project_id": "uuid", "status": "pending", "message": "Pipeline started"}
```

### 7.5 List Projects
```bash
curl http://localhost:8000/api/projects/ ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7.6 Get Project Graph
```bash
curl http://localhost:8000/api/projects/PROJECT_ID/graph ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7.7 Get Findings
```bash
curl http://localhost:8000/api/projects/PROJECT_ID/findings ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7.8 Chat (RAG)
```bash
curl -X POST http://localhost:8000/api/projects/PROJECT_ID ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"What connections exist between the entities?\"}"
```

Response streams via SSE.

---

## Architecture Overview

```
Request Flow:
─────────────
User uploads files → POST /api/projects/
                     ├── Files parsed (PyMuPDF / txt decode)
                     ├── Text chunked (800 chars, 100 overlap)
                     ├── Chunks embedded locally (HuggingFace)
                     ├── Stored in pgvector (Supabase)
                     └── Pipeline starts (background task)

Pipeline (sequential):
──────────────────────
1. Ingestion Agent  (Groq 8B)  → classify documents
2. Entity Agent     (Groq 8B)  → extract entities & relationships
3. Pattern Agent    (Groq 70B) → detect suspicious patterns
4. Factcheck Agent  (Groq 70B) → verify via RAG retrieval
5. Narrative Agent  (Groq 70B) → write investigation brief

All stages emit SSE events → GET /api/stream/{project_id}
```

---

## File Structure

```
backend/
├── main.py              ← FastAPI app entry point
├── config.py            ← Pydantic settings (env vars)
├── requirements.txt     ← Python dependencies
├── .env.example         ← Environment variable template
│
├── db/
│   ├── supabase.py      ← Supabase client singleton
│   └── schema.sql       ← Database schema (run in Supabase SQL Editor)
│
├── core/
│   ├── embedder.py      ← HuggingFace embedding (local, zero cost)
│   ├── parser.py        ← PDF/TXT parsing + text chunking
│   ├── vector_store.py  ← pgvector search wrapper
│   └── orchestrator.py  ← 5-agent pipeline coordinator
│
├── agents/
│   ├── ingestion_agent.py   ← Document classification
│   ├── entity_agent.py      ← Named entity extraction
│   ├── pattern_agent.py     ← Suspicious pattern detection
│   ├── factcheck_agent.py   ← RAG-based fact verification
│   └── narrative_agent.py   ← Investigation brief drafting
│
└── api/
    ├── auth.py          ← Register, Login, JWT
    ├── projects.py      ← CRUD + file upload
    ├── stream.py        ← SSE pipeline events
    └── chat.py          ← RAG chat with streaming
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError` | Make sure venv is activated: `.venv\Scripts\activate` |
| `GROQ_API_KEY not set` | Check `.env` file exists and has the key |
| Supabase connection error | Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env` |
| Embedding model download fails | Check internet connection, model downloads on first import |
| `401 Unauthorized` on API calls | Token expired — login again to get a fresh token |
| Pipeline stuck | Check terminal logs for agent errors, verify Groq API key works |
| Schema error in Supabase | Make sure you ran `schema.sql` in SQL Editor, check pgvector extension enabled |

---

## Sample Test Files

Create a simple test file to try the pipeline:

**sample.txt:**
```
Financial Investigation Report - Q3 2024

Raj Mehta, Director of FastTrade Pvt Ltd (Mumbai), authorized a wire transfer
of $2.4 million to Swiss Account #447 on September 15, 2024. The account is
held by Offshore Holdings BVI, a company registered in the British Virgin
Islands on September 14, 2024 — one day before the transfer.

Offshore Holdings BVI lists Shell Corp Cayman as its parent company. Shell Corp
Cayman was incorporated on September 13, 2024. Legal Firm XYZ provided
registration services for all three entities: FastTrade, Offshore Holdings,
and Shell Corp Cayman.

The rapid incorporation timeline and circular ownership structure suggest
potential money laundering or tax evasion. FastTrade's quarterly revenue of
$800,000 does not justify a $2.4 million outbound transfer.
```

Upload this file to test the full pipeline — the agents should detect:
- Entities: Raj Mehta, FastTrade, Offshore Holdings, etc.
- Pattern: unusual timing (companies registered 1 day before transfer)
- Pattern: circular ownership structure
- Pattern: financial mismatch ($800K revenue vs $2.4M transfer)
