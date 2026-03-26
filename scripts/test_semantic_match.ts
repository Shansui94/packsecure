import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function getEmbedding(text: string): Promise<number[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

async function testMatch(userInput: string) {
    console.log(`\n🔍 Testing: "${userInput}"`);
    const embedding = await getEmbedding(userInput);
    
    const { data, error } = await supabase.rpc('match_location', {
        query_embedding: embedding,
        match_threshold: 0.5,  // Low threshold to see all results
        match_count: 3
    });

    if (error) {
        console.error("RPC Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("❌ No matches found.");
        return;
    }

    data.forEach((match: any, i: number) => {
        const pct = (match.similarity * 100).toFixed(1);
        const icon = match.similarity > 0.85 ? '✅' : match.similarity > 0.7 ? '⚠️' : '❓';
        console.log(`  ${icon} #${i+1}: ${match.location_name} (${pct}%)`);
    });
}

async function runTests() {
    console.log("=== 🧪 AI Semantic Location Matching Test ===");
    
    // Test 1: Exact match
    await testMatch("IPOH");
    
    // Test 2: Abbreviation
    await testMatch("BM");
    
    // Test 3: Common misspelling
    await testMatch("Alor Star");  // Should match "ALOR SETAR"
    
    // Test 4: Lowercase + abbreviation
    await testMatch("sg petani");  // Should match "SUNGAI PETANI"
    
    // Test 5: Partial name
    await testMatch("Kedah Jitra"); // Should match "JITRA"
    
    // Test 6: Totally wrong / new location
    await testMatch("Johor Bahru"); // Should NOT match anything above 85%
    
    // Test 7: Mixed language
    await testMatch("去槟城送货"); // Should match "PENANG"
    
    console.log("\n=== Test Complete ===");
}

runTests().catch(console.error);
