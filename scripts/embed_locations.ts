import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// For local script context, load from .env manually if process.env misses it
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("FATAL: Gemini API Key is missing. Cannot convert locations to vector embeddings.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function extractEmbedding(text: string): Promise<number[] | null> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (e: any) {
        console.error(`Error embedding text "${text}":`, e.message);
        return null;
    }
}

async function processLocations() {
    console.log("Fetching delivery_rates to embed standard locations...");
    
    const { data: rates, error } = await supabase.from('delivery_rates').select('id, origin, location_name, location_embedding');
    
    if (error) {
        console.error("Failed to fetch rates:", error);
        return;
    }
    
    if (!rates || rates.length === 0) {
        console.log("No rates found in the database.");
        return;
    }
    
    console.log(`Found ${rates.length} rates perfectly ready for vectorization.`);
    
    let processedCount = 0;

    for (const rate of rates) {
        // Skip if it already has an embedding
        if (rate.location_embedding) {
            console.log(`Skipping [${rate.location_name}] - already embedded.`);
            continue;
        }

        console.log(`Embedding [${rate.origin} -> ${rate.location_name}]...`);
        // We embed "origin to location_name" combined to give it richer context, 
        // e.g., "From TAIPING to Sungai Buloh". Or just the location_name if the user only types the location.
        // Usually, the user only types the location name in the UI. So let's embed just the location_name.
        const cleanName = rate.location_name.trim();
        const embedding = await extractEmbedding(cleanName);
        
        if (embedding && embedding.length > 0) {
            // Update the Supabase record. We must pass the raw array `[0.1, 0.2, ...]` to pgvector
            // Supabase/PostgREST automatically parses JSON arrays into vector types!
            const { error: updateErr } = await supabase
                .from('delivery_rates')
                .update({ location_embedding: embedding })
                .eq('id', rate.id);

            if (updateErr) {
                console.error(`Failed to update ${rate.location_name}:`, updateErr);
            } else {
                processedCount++;
                console.log(`✅ Success: ${rate.location_name}`);
            }
        }
        
        // Anti-rate-limit sleep
        await new Promise(r => setTimeout(r, 200)); 
    }
    
    console.log(`\n🎉 Finished! Successfully generated & saved embeddings for ${processedCount} locations.`);
}

processLocations().catch(console.error);
