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

---

## 💰 LLM Cost Analysis (3-File Investigation Example)

Nexora is designed to run on high-performance models while maintaining a **$0.00 operational cost** for investigators. Below is a breakdown of a typical investigation involving **3 documents** (~6,000 total tokens).

| Pipeline Stage | Agent / Service | LLM Model | Est. Tokens | Provider | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Document Ingestion** | Ingestion Agent | Llama 3.3 70B | 1,200 | Groq | $0.00 |
| **Semantic Vectorization** | Gemini Embedder | text-embedding-004 | 6,000 | Google AI | $0.00 |
| **Entity Extraction** | Entity Agent | Llama 3.3 70B | 15,000 | Groq | $0.00 |
| **Pattern Detection** | Pattern Agent | Llama 3.3 70B | 3,000 | Groq | $0.00 |
| **Fact-Verification** | Fact-check Agent | Llama 3.3 70B | 4,500 | Groq | $0.00 |
| **Narrative Drafting** | Narrative Agent | Llama 3.3 70B | 1,500 | Groq | $0.00 |
| **Investigative Chat** | Chat Agent | Llama 3.3 70B | 2,000 | Groq | $0.00 |
| **Total** | | | **33,200** | | **$0.00** |

> **Note**: All used models are within the generous Free Tier limits of Groq and Google AI Studio, making Nexora a powerful, zero-cost tool for investigative journalism.

