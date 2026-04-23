-- InvestiGraph AI — Database Schema
-- Run this in Supabase SQL Editor.
-- Requires pgvector extension.

CREATE EXTENSION IF NOT EXISTS vector;

-- Users table — custom auth (not using Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  story_draft TEXT,
  entity_count INTEGER DEFAULT 0,
  finding_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  content_preview TEXT,
  chunk_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Chunks with 768-dim embeddings (Google gemini-embedding-001)
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Entities (graph nodes)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  aliases TEXT[],
  suspicion_score INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Relationships (graph edges)
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  entity_a_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  entity_b_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  relation_label TEXT NOT NULL,
  source_document TEXT,
  confidence_score FLOAT DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Findings
CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  pattern_type TEXT,
  suspicion_score INTEGER DEFAULT 5,
  verified BOOLEAN DEFAULT false,
  confidence TEXT DEFAULT 'low',
  supporting_evidence TEXT,
  gaps TEXT,
  legal_risk TEXT DEFAULT 'low',
  entities_involved TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity search function (768 dimensions)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(768),
  filter_project_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  WHERE chunks.project_id = filter_project_id
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS entities_project_idx
  ON entities(project_id);

CREATE INDEX IF NOT EXISTS relationships_project_idx
  ON relationships(project_id);

CREATE INDEX IF NOT EXISTS users_email_idx
  ON users(email);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so no policies needed for backend.
-- These policies are for direct Supabase client access only.
CREATE POLICY "Users see own data" ON projects FOR ALL USING (true);
CREATE POLICY "Full access docs" ON documents FOR ALL USING (true);
CREATE POLICY "Full access chunks" ON chunks FOR ALL USING (true);
CREATE POLICY "Full access entities" ON entities FOR ALL USING (true);
CREATE POLICY "Full access rels" ON relationships FOR ALL USING (true);
CREATE POLICY "Full access findings" ON findings FOR ALL USING (true);
CREATE POLICY "Full access users" ON users FOR ALL USING (true);
