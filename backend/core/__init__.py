"""
Core package for InvestiGraph AI.

Contains the foundational modules that all agents depend on:
  - embedder: HuggingFace sentence-transformers for local embedding generation
  - parser: PDF/TXT parsing and text chunking via LangChain
  - vector_store: pgvector similarity search operations
  - orchestrator: Sequential pipeline coordinating all 5 AI agents
"""
