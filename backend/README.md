# 🔍 InvestiGraph AI — Backend

FastAPI backend powering the AI investigative journalism platform. Runs a 5-agent LangChain pipeline with RAG-powered document analysis.

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Framework | FastAPI | Async support, auto-docs, Pydantic validation |
| LLM | Groq (Llama 3.1 8B & 70B) | Free tier, ultra-low latency |
| Embeddings | HuggingFace all-MiniLM-L6-v2 | Runs locally, zero API cost |
| Database | Supabase PostgreSQL + pgvector | Free tier, built-in vector search |
| Auth | Supabase Auth + python-jose JWT | Managed auth with local JWT validation |

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Fill in your Groq API key and Supabase credentials

# 3. Run the Supabase schema
# Go to Supabase Dashboard → SQL Editor → paste db/schema.sql → Run

# 4. Start the server
uvicorn main:app --reload --port 8000
```

## Project Structure

```
backend/
├── agents/              # 5 AI agents (see agents/README.md)
├── api/                 # FastAPI route handlers
│   ├── auth.py          # POST /register, /login, GET /me
│   ├── projects.py      # CRUD for investigations
│   ├── stream.py        # SSE endpoint for live updates
│   └── chat.py          # RAG-powered chat
├── core/                # Shared infrastructure
│   ├── embedder.py      # HuggingFace embedding engine
│   ├── parser.py        # PDF/TXT parsing + chunking
│   ├── vector_store.py  # pgvector search wrapper
│   └── orchestrator.py  # Pipeline coordinator
├── db/
│   ├── supabase.py      # DB client singleton
│   └── schema.sql       # Full database schema
├── tests/               # pytest test suite
├── main.py              # FastAPI app entry point
├── config.py            # Pydantic settings
└── requirements.txt
```

## API Endpoints

### Authentication — `/api/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create new user account | No |
| POST | `/api/auth/login` | Authenticate and get JWT | No |
| GET | `/api/auth/me` | Get current user info | JWT |

**POST /api/auth/register**
```json
// Request
{ "email": "user@example.com", "password": "securepassword" }

// Response 201
{ "access_token": "eyJ...", "token_type": "bearer", "user_id": "uuid" }
```

**POST /api/auth/login**
```json
// Request
{ "email": "user@example.com", "password": "securepassword" }

// Response 200
{ "access_token": "eyJ...", "token_type": "bearer", "user_id": "uuid" }
```

---

### Projects — `/api/projects`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/projects/` | Create investigation + upload files | JWT |
| GET | `/api/projects/` | List user's investigations | JWT |
| GET | `/api/projects/{id}` | Get project details + stats | JWT |
| GET | `/api/projects/{id}/graph` | Get entities + relationships | JWT |
| GET | `/api/projects/{id}/findings` | Get findings sorted by suspicion | JWT |
| DELETE | `/api/projects/{id}` | Delete project and all data | JWT |

**POST /api/projects/** (multipart/form-data)
```
Fields:
  name: "Panama Papers Investigation"
  description: "Analyzing leaked financial documents for offshore connections"
  files: [document1.pdf, document2.txt]  (max 5 files, 10MB each, PDF/TXT only)

Response 201:
{ "project_id": "uuid", "status": "pending", "message": "Pipeline started" }
```

**GET /api/projects/{id}/graph**
```json
// Response 200
{
  "nodes": [
    { "id": "uuid", "name": "Raj Mehta", "type": "person", "suspicion_score": 8 }
  ],
  "links": [
    { "source": "uuid1", "target": "uuid2", "label": "owns", "confidence": 0.9 }
  ]
}
```

**GET /api/projects/{id}/findings**
```json
// Response 200
[
  {
    "title": "Circular Ownership Pattern",
    "description": "Entity A owns B which owns A through shell companies",
    "pattern_type": "circular_ownership",
    "suspicion_score": 9,
    "verified": true,
    "confidence": "high",
    "legal_risk": "high",
    "entities_involved": ["Entity A", "Entity B"]
  }
]
```

---

### Streaming — `/api/stream`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/stream/{project_id}` | SSE stream for pipeline updates | JWT |

**SSE Event Types:**
```
event: status
data: {"message": "🔍 Extracting entities...", "stage": "extracting"}

event: progress
data: {"percent": 40}

event: graph_update
data: {"type": "node", "data": {"name": "Raj Mehta", "type": "person"}}

event: graph_update
data: {"type": "edge", "data": {"entity_a": "Raj", "entity_b": "Corp", "label": "owns"}}

event: complete
data: {"entity_count": 24, "finding_count": 5, "elapsed_seconds": 45.2}

event: error
data: {"message": "Pipeline failed: ..."}
```

---

### Chat — `/api/chat`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/chat/{project_id}` | RAG-powered Q&A (SSE streamed) | JWT |

**POST /api/chat/{project_id}**
```json
// Request
{ "message": "What is the connection between Raj Mehta and Offshore Holdings?" }

// Response: SSE stream of text chunks
data: {"chunk": "Based on the documents, "}
data: {"chunk": "Raj Mehta is listed as "}
data: {"chunk": "the sole director of Offshore Holdings BVI..."}
data: {"done": true}
```

---

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health + model status |

```json
// Response 200
{ "status": "healthy", "model": "all-MiniLM-L6-v2", "embedding_dim": 384 }
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for LLM calls |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (server-side only) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `JWT_ALGORITHM` | No | Default: HS256 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default: 60 |
| `FRONTEND_URL` | No | Default: http://localhost:5173 |

## Database Schema

See [db/schema.sql](db/schema.sql) for the complete schema. Key tables:

- **projects** — Investigation metadata and status
- **documents** — Uploaded files
- **chunks** — Text chunks with 384-dim vector embeddings (pgvector)
- **entities** — Graph nodes (person, org, location, financial, date, event)
- **relationships** — Graph edges between entities
- **findings** — Detected suspicious patterns with verification status
