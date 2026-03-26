-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to delivery_rates
ALTER TABLE delivery_rates ADD COLUMN IF NOT EXISTS location_embedding vector(768);

-- 3. Create Cosine Similarity search function for locations
CREATE OR REPLACE FUNCTION match_location (
    query_embedding vector(768),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    location_name text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        delivery_rates.id,
        delivery_rates.location_name,
        1 - (delivery_rates.location_embedding <=> query_embedding) AS similarity
    FROM delivery_rates
    WHERE delivery_rates.location_embedding IS NOT NULL
    AND 1 - (delivery_rates.location_embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- 4. Create Knowledge Base table for Phase 3 (Future-proofing)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text,
    content text,
    metadata jsonb,
    embedding vector(768),
    created_at timestamptz DEFAULT NOW()
);

-- 5. Create Cosine Similarity search function for Knowledge Base
CREATE OR REPLACE FUNCTION match_knowledge (
    query_embedding vector(768),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        knowledge_base.id,
        knowledge_base.title,
        knowledge_base.content,
        knowledge_base.metadata,
        1 - (knowledge_base.embedding <=> query_embedding) AS similarity
    FROM knowledge_base
    WHERE 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;
