# 🤖 InvestiGraph AI — Agent Pipeline

Five specialized LangChain AI agents that form a sequential investigation pipeline. Each agent has a single responsibility and communicates through structured data.

## Pipeline Overview

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────────────┐
│  INGESTION   │──▶│   ENTITY     │──▶│   PATTERN    │──▶│  FACTCHECK    │──▶│   NARRATIVE    │
│   Agent      │   │   Agent      │   │   Agent      │   │   Agent       │   │    Agent       │
│ (8B, fast)   │   │ (8B, fast)   │   │ (70B, smart) │   │ (70B, smart)  │   │ (70B, writer)  │
└─────────────┘   └──────────────┘   └──────────────┘   └───────────────┘   └────────────────┘
  Parse & classify   Extract entities   Find suspicious    Verify against      Write the
  documents          & relationships    patterns           source docs (RAG)   investigation brief
```

## Agents

### 1. Ingestion Agent (`ingestion_agent.py`)

| Property | Value |
|----------|-------|
| LLM | Groq `llama-3.1-8b-instant` |
| Purpose | Parse files and classify document types |
| Input | Raw document text previews |
| Output | Classification metadata (type, jurisdiction, key topic, entity hints) |

**Why 8B model?** Classification is a simple task — speed matters more than reasoning depth here. The 8B model responds in ~100ms vs ~500ms for 70B.

**Key function:** `classify_document(text_preview) → dict`

---

### 2. Entity Agent (`entity_agent.py`)

| Property | Value |
|----------|-------|
| LLM | Groq `llama-3.1-8b-instant` |
| Purpose | Extract named entities and relationships from text |
| Input | Text chunks (batched 3 at a time) |
| Output | Deduplicated entities + relationships |

**Entity types:** `person`, `organization`, `location`, `financial`, `date`, `event`

**Why batch of 3?** Balances context utilization (3 × 800 chars = 2400 chars + prompt fits in 8K context) with extraction accuracy.

**Key function:** `extract_from_batch(text) → {"entities": [...], "relationships": [...]}`

Emits `graph_update` SSE events as entities are discovered for live graph animation.

---

### 3. Pattern Agent (`pattern_agent.py`)

| Property | Value |
|----------|-------|
| LLM | Groq `llama-3.1-70b-versatile` |
| Purpose | Detect suspicious patterns across the full entity graph |
| Input | Complete entity + relationship lists |
| Output | Scored findings with pattern classification |

**Patterns detected:**
- `circular_ownership` — A owns B owns A
- `unusual_timing` — company registered same day as contract
- `hidden_intermediary` — same person in many unrelated deals
- `financial_mismatch` — amounts don't match across documents
- `geographic_anomaly` — BVI company, Indian directors, Swiss accounts
- `recurring_actor` — same lawyer/accountant in suspicious deals

**Why 70B model?** Pattern detection requires reasoning across multiple relationships — the 70B model handles multi-hop logic significantly better.

**Key function:** `analyze(entities, relationships) → list[findings]`

---

### 4. Factcheck Agent (`factcheck_agent.py`)

| Property | Value |
|----------|-------|
| LLM | Groq `llama-3.1-70b-versatile` |
| Purpose | Verify findings against source documents using RAG |
| Input | Each finding + top-5 relevant chunks from pgvector |
| Output | Verified findings with confidence, evidence, gaps, legal risk |

**RAG flow:**
1. For each finding → generate search query from title + description
2. Embed query locally → cosine similarity search in pgvector
3. Retrieve top 5 matching chunks with similarity scores
4. Send finding + evidence to LLM for verification assessment

**Why 70B model?** Accuracy is critical — we need the model to carefully distinguish between "evidence supports this" vs "evidence is tangentially related."

**Key function:** `verify_finding(finding, evidence_chunks) → verified_finding`

---

### 5. Narrative Agent (`narrative_agent.py`)

| Property | Value |
|----------|-------|
| LLM | Groq `llama-3.1-70b-versatile` |
| Purpose | Write the investigation brief from verified findings |
| Input | All findings, entities, project description |
| Output | Formatted investigation brief (max 500 words) |

**Output structure:**
- HEADLINE — compelling one-liner
- SUMMARY — 2-3 sentence overview
- KEY FINDINGS — bullets, `[UNVERIFIED]` tags where applicable
- CONNECTIONS — suspicious relationships
- IMPACT — who's affected
- NEXT STEPS — what to investigate further

**Key function:** `draft(findings, entities, project_description) → str`

## API Call Budget (per investigation, ~60 chunks)

| Agent | Model | Calls | Purpose |
|-------|-------|-------|---------|
| Ingestion | 8B | 2 | Classify 2 documents |
| Entity | 8B | 21 | Extract from 60 chunks in batches of 3 |
| Pattern | 70B | 3 | Analyze entity graph |
| Factcheck | 70B | 5 | Verify top 5 findings |
| Narrative | 70B | 1 | Draft the brief |
| **Total** | | **32** | Well within Groq's 14,400/day free limit |

## Error Handling

Every agent wraps LLM calls in `try/except`:
- **JSON parse errors** → returns empty/default results, pipeline continues
- **API errors** → logged with full traceback, returns graceful defaults
- **Timeout** → Groq has built-in timeout, caught and logged

The orchestrator catches per-agent failures and continues with available data rather than failing the entire pipeline.

## Adding a New Agent

1. Create `agents/new_agent.py`
2. Initialize `ChatGroq` with appropriate model
3. Define `ChatPromptTemplate` with structured JSON output
4. Implement `async def run(inputs, emit=None) → output`
5. Add to pipeline in `core/orchestrator.py`
