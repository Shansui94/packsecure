// Direct REST test to avoid package issues
async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ Please set GEMINI_API_KEY in .env file first!");
        return;
    }

    console.log("Checking available models for key...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.models) {
            console.log("✅ Models available:");
            data.models.forEach((m: any) => console.log(` - ${m.name} (${m.supportedGenerationMethods})`));
        } else {
            console.error("❌ No models found or error:", data);
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

run();
