# 🤖 Nexora — Agent Pipeline

Nexora utilizes six specialized LangChain AI agents that form a sequential investigation pipeline. Each agent has a single responsibility and communicates through structured JSON data.

## Pipeline Overview

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────────────┐
│  INGESTION   │──▶│   ENTITY     │──▶│   PATTERN    │──▶│  FACTCHECK    │──▶│   NARRATIVE    │
│   Agent      │   │   Agent      │   │   Agent      │   │   Agent       │   │    Agent       │
└─────────────┘   └──────────────┘   └──────────────┘   └───────────────┘   └────────────────┘
  Parse & classify   Extract entities   Find suspicious    Verify against      Write the
  documents          & relationships    patterns           source docs (RAG)   investigation brief
```

## Agents Technical Specifications

### 1. Ingestion Agent (`ingestion_agent.py`)
- **LLM**: Groq `llama-3.3-70b-versatile`
- **Purpose**: Parse files and classify document types.
- **Output**: JSON containing `document_type`, `jurisdiction`, `key_topic`.

### 2. Entity Agent (`entity_agent.py`)
- **LLM**: Groq `llama-3.3-70b-versatile`
- **Purpose**: Extract named entities (Person, Org, Location, Financial, Date, Event) and their relationships.
- **Real-time**: Emits `graph_update` events via SSE to build the live visualization.

### 3. Pattern Agent (`pattern_agent.py`)
- **LLM**: Groq `llama-3.3-70b-versatile`
- **Purpose**: Detect suspicious patterns such as circular ownership, unusual timing, and geographic anomalies.

### 4. Factcheck Agent (`factcheck_agent.py`)
- **LLM**: Groq `llama-3.3-70b-versatile`
- **Purpose**: Verifies all detected patterns against source documents using **Semantic RAG** (via Gemini Embeddings + pgvector).

### 5. Narrative Agent (`narrative_agent.py`)
- **LLM**: Groq `llama-3.3-70b-versatile`
- **Purpose**: Drafts a cohesive investigative brief based on verified findings and the project's specific description.

---

## Performance & Optimization

- **Streaming**: All agents emit status messages to a live telemetry side-panel.
- **Batching**: Entity extraction is batched (3 chunks per call) to maximize context utilization while maintaining extraction density.
- **Hallucination Prevention**: The Factcheck agent explicitly looks for grounding evidence in retrieved chunks before marking a pattern as "Verified".
