import { useState } from 'react';

interface AIAction {
    type: 'FILTER' | 'CREATE_DRAFT' | 'ANALYZE' | 'NAVIGATE' | 'UNKNOWN';
    payload: any;
    reasoning: string;
}

export const useAICommand = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const callGemini = async (model: string, apiKey: string, systemPrompt: string, userQuery: string) => {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { text: `User Query: "${userQuery}"` }
                    ]
                }]
            })
        });
        if (!response.ok) throw new Error(`${model} Error: ${response.statusText}`);
        return response.json();
    };

    const executeCommand = async (userQuery: string, currentContext: any): Promise<AIAction> => {
        setLoading(true);
        setError(null);

        const apiKey = localStorage.getItem('google_api_key');
        if (!apiKey) {
            setLoading(false);
            throw new Error("Critical: No API Key configured. Please settings.");
        }

        try {
            // 1. Construct System Prompt
            const systemPrompt = `
You are JARVIS, an AI Data Assistant for a factory management system.
Current Context (Tab: ${currentContext.tab}): 
${JSON.stringify(currentContext.sample || [])}

Your goal is to map the user's natural language query to a JSON action.

# Supported Actions:
1. FILTER: User wants to see specific items (e.g. "red items", "machines in Factory A").
   Output: { "type": "FILTER", "payload": { "keyword": "string" }, "reasoning": "..." }
2. CREATE_DRAFT: User wants to add data (e.g. "New customer named Tesla").
   Output: { "type": "CREATE_DRAFT", "payload": { ...guessed_fields }, "reasoning": "..." }
3. ANALYZE: User asks for insights (e.g. "How many active machines?").
   Output: { "type": "ANALYZE", "payload": { "summary": "markdown string" }, "reasoning": "..." }
4. NAVIGATE: User wants to switch tabs (e.g. "Go to Vehicles").
   Output: { "type": "NAVIGATE", "payload": { "tabId": "items" | "vehicles" | "customers" | "machines" }, "reasoning": "..." }

# Rules:
- Return ONLY valid JSON.
- If unsure, return { "type": "UNKNOWN", "payload": {}, "reasoning": "Need clarification" }
            `;

            let data;
            try {
                // Try 2.0 First (Better reasoning)
                data = await callGemini('gemini-2.0-flash-exp', apiKey, systemPrompt, userQuery);
            } catch (e) {
                console.warn("Gemini 2.0 failed, falling back to 1.5", e);
                // Fallback to 1.5 (More stable)
                data = await callGemini('gemini-1.5-flash', apiKey, systemPrompt, userQuery);
            }

            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResponse) throw new Error("No response from AI");

            // 3. Robust JSON Parsing
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Invalid JSON response");

            const result: AIAction = JSON.parse(jsonMatch[0]);
            return result;

        } catch (err: any) {
            console.error("AI Command Error:", err);
            setError(err.message);
            // Return specific error for chat
            return { type: 'ANALYZE', payload: { summary: `⚠️ System Error: ${err.message}. Please check API Key.` }, reasoning: "Error" };
        } finally {
            setLoading(false);
        }
    };

    return { executeCommand, loading, error };
};
