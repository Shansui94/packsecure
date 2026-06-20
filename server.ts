import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import chatHandler from './api/agent/chat';
import manageEmployeeHandler from './api/manage-employee';
import visionHandler from './api/agent/vision';
import geocodeHandler from './api/geocode';
import aiPhotoHandler from './api/agent/ai-photo';

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const mountVercelHandler = (path: string, handler: (req: any, res: any) => Promise<void | unknown>) => {
    app.all(path, async (req, res) => {
        try {
            await handler(req, res);
        } catch (err) {
            console.error(`Handler Error [${path}]:`, err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal Server Error' });
            }
        }
    });
};

mountVercelHandler('/api/manage-employee', manageEmployeeHandler);
mountVercelHandler('/api/agent/vision', visionHandler);
mountVercelHandler('/api/geocode', geocodeHandler);
mountVercelHandler('/api/agent/ai-photo', aiPhotoHandler);

// Mimic Vercel Request/Response for the handler
app.post('/api/agent/chat', async (req, res) => {
    try {
        // Log for debugging
        console.log(`[API] POST /api/agent/chat - Query: ${req.body.query?.substring(0, 50)}...`);

        // Call the Vercel-style handler
        await chatHandler(req as any, res as any);
    } catch (err) {
        console.error("Handler Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`\n✅ Local API Server running at http://localhost:${PORT}`);
    console.log(`   - Chat:           http://localhost:${PORT}/api/agent/chat`);
    console.log(`   - Vision:         http://localhost:${PORT}/api/agent/vision`);
    console.log(`   - HR / Drivers:   /api/manage-employee, /api/create-driver, /api/delete-driver`);
    console.log(`   - AI Model: Gemini 2.0 Flash (Validated)\n`);
});
