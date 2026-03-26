import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration() {
    const rawSql = `
        -- Drop old functions
        DROP FUNCTION IF EXISTS match_location;
        DROP FUNCTION IF EXISTS match_knowledge;

        -- Alter column to 3072
        ALTER TABLE delivery_rates ALTER COLUMN location_embedding TYPE vector(3072);
        
        -- Recreate function with 3072
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
        
        -- Alter knowledge base to 3072
        ALTER TABLE knowledge_base ALTER COLUMN embedding TYPE vector(3072);

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
    `;

    console.log("Executing Vector Dimension Fix Migration...");
    
    const headers = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, { method: 'POST', headers, body: JSON.stringify({ query: rawSql }) });

    const resultText = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", resultText);
}

runMigration().catch(console.error);
