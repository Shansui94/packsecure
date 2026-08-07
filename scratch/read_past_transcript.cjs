const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:/Users/Max Tan/.gemini/antigravity/brain/9b7a1a72-1ec3-44d3-8935-ec6381dc87ce/.system_generated/logs/transcript.jsonl';

if (fs.existsSync(transcriptPath)) {
    console.log("Transcript exists! Reading lines...");
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    console.log(`Total steps/lines in transcript: ${lines.length}`);
    // Print the last 15 lines of the transcript to see what the final steps were
    lines.slice(-15).forEach((line, index) => {
        try {
            const obj = JSON.parse(line);
            console.log(`\n--- Step ${obj.step_index || index} | Source: ${obj.source} | Type: ${obj.type} ---`);
            if (obj.content) {
                console.log(obj.content.substring(0, 1000));
            }
            if (obj.tool_calls) {
                console.log("Tool calls:", JSON.stringify(obj.tool_calls, null, 2));
            }
        } catch (e) {
            console.error("Error parsing line:", e);
        }
    });
} else {
    console.log("Transcript not found at path:", transcriptPath);
}
