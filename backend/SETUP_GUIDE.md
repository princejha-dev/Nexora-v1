# 🚀 Nexora — Backend Setup Guide

## Prerequisites

- Python 3.11+
- A [Groq](https://console.groq.com) account (for LLM reasoning)
- A [Google AI Studio](https://aistudio.google.com/) account (for Gemini Embeddings)
- A [Supabase](https://supabase.com) project (for Database + Vector Store)

---

## Step 1: Install Dependencies

```bash
cd backend
python -m venv venv
# Activate the venv:
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

pip install -r requirements.txt
```

---

## Step 2: Set Up Supabase

### 2.1 Create a Supabase Project
1. Go to https://supabase.com → New Project.
2. Go to **Settings → API** and collect your `Project URL`, `anon` key, and `service_role` key.

### 2.2 Run the Database Schema
1. Go to **SQL Editor** in Supabase Dashboard.
2. Paste the entire contents of `db/schema.sql` and click **Run**.
3. Verify that tables like `projects`, `entities`, and `chunks` are created.

---

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=...
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=...
SUPABASE_ANON_KEY=...
JWT_SECRET=your_random_secret
```

---

## Step 4: Verification Tests

### 4.1 Test Gemini Embeddings
```bash
python -c "from core.embedder import embed_query; v = embed_query('test'); print(f'OK: {len(v)} dimensions')"
```
Expected output: `OK: 768 dimensions`

### 4.2 Test Groq LLM (Llama 3.3 70B)
```bash
python -c "
from langchain_groq import ChatGroq
from config import get_settings
llm = ChatGroq(model_name='llama-3.3-70b-versatile', api_key=get_settings().GROQ_API_KEY)
r = llm.invoke('Hello')
print('Groq OK:', r.content)
"
```

---

## Step 5: Start the Server

```bash
uvicorn main:app --reload --port 8000
```

- **Health Check**: `http://localhost:8000/health`
- **Swagger Docs**: `http://localhost:8000/docs`

---

## Architecture Flow

1. **Upload**: User uploads PDFs/TXTs.
2. **Parsing**: Documents are parsed and chunked.
3. **Embedding**: Chunks are embedded using **Gemini-1.5-Flash** (768 dim).
4. **Storage**: Vectors stored in **pgvector** (Supabase).
5. **Pipeline**: 6-Agent pipeline runs sequentially, emitting live updates via **SSE**.
6. **Interaction**: Users explore the Knowledge Graph and chat with the data.
