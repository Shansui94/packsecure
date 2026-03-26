-- Drop old functions that depend on the vector type
DROP FUNCTION IF EXISTS match_location;
DROP FUNCTION IF EXISTS match_knowledge;

-- We cannot easily ALTER vector(768) to vector(3072) if there's type casting issues,
-- but since the table is currently empty of vectors, we can just drop the column and recreate it.
ALTER TABLE delivery_rates DROP COLUMN IF EXISTS location_embedding;
ALTER TABLE delivery_rates ADD COLUMN location_embedding vector(3072);

-- Recreate the function with vector(3072)
CREATE OR REPLACE FUNCTION match_location (
    query_embedding vector(3072),
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

-- Drop and recreate the embedding column for knowledge_base
ALTER TABLE knowledge_base DROP COLUMN IF EXISTS embedding;
ALTER TABLE knowledge_base ADD COLUMN embedding vector(3072);

-- Recreate function with 3072
CREATE OR REPLACE FUNCTION match_knowledge (
    query_embedding vector(3072),
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
