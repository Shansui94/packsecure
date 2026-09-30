


/**
 * AI Supervisor Service
 * Handles interaction with Google Gemini for production insights.
 */
export const aiService = {
    /**
     * Generates a response based on user query and provided data context.
     * @param query The user's natural language question (e.g., "Any gaps today?")
     * @param contextData Structured JSON data (logs, users, machine status)
     * @returns AI text response
     */
    async askSupervisor(query: string, contextData: any): Promise<string> {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        console.log(`[AI Service] Using API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

        try {
            // FALLBACK: Use direct REST API if SDK fails (which it is doing consistently with 404s)
            // SDK Initialization
            // const genAI = new GoogleGenerativeAI(apiKey);
            // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            // const result = await model.generateContent(prompt);
            // const response = result.response;
            // return response.text();

            // Construct Prompt
            const prompt = `
            You are the 'AI Production Supervisor' for Packsecure, a factory manufacturing packaging materials.
            
            **CRITICAL CONTEXT:**
            - The data provided in 'recentLogs' are **NORMAL PRODUCTION CYCLES** (Machine pulses).
            - 'Produced_Units: 1' means **1 Unit Produced**. It is NOT an error or warning.
            - High frequency of logs is GOOD (means high production speed).
            - **Anomalies to look for:**
              1. **Long Gaps**: If a machine was Active but has no logs for >10 mins (Downtime).
              2. **Low Efficiency**: If logs are too spaced out.
              3. **Idle Machines**: Machines marked 'Status: Active' but calculating 0 output.

            Current Context:
            - Daily Production Statistics (TODAY): ${JSON.stringify(contextData.dailyStats || {})}
            - Yesterday's Statistics (PREVIOUS SHIFT): ${JSON.stringify(contextData.yesterdayStats || {})}
            - Machine Standards (Targets): ${JSON.stringify(contextData.machineStandards || {})}
            - Active Machines: ${JSON.stringify(contextData.activeMachines || [])}
            - Recent Production Logs (Last 50): ${JSON.stringify(contextData.recentLogs || [])}
            - Current Time: ${new Date().toLocaleTimeString()}

            User Query: "${query}"

            Instructions:
            1. **Reply in the SAME Language as the User Query.**
            2. Be professional and data-driven.
            3. **Shift Handover Logic**: If current time is early (00:00-08:00) AND 'Daily Stats Total' is low (<50), assume user might be asking about YESTERDAY/PREVIOUS SHIFT. Mention both today's (low) and yesterday's (final) numbers.
            4. **Calculate Efficiency**: Use 'Daily Stats Total' / 'Expected Daily Output'.
               - If < 100%, explain WHY by looking at **'gapsFound'**.
            5. Interpret logs as production output.
            
            Answer:
            `;

            console.log("Using REST API for Gemini...");
            const apiVersion = "v1beta";
            // Updated candidates based on verified available models
            const candidates = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"];

            let lastError;

            for (const modelId of candidates) {
                try {
                    console.log(`Trying model: ${modelId}...`);
                    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:generateContent?key=${apiKey}`;

                    const response = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
                    }

                    const data = await response.json();
                    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                        return data.candidates[0].content.parts[0].text;
                    }
                } catch (e: any) {
                    console.warn(`Failed ${modelId}: ${e.message}`);
                    lastError = e;
                }
            }
            throw lastError || new Error("All models failed.");

        } catch (error: any) {
            console.error("AI Service Error:", error);
            return `System Error: Failed to consult AI Supervisor. (${error.message})`;
        }
    }
};
