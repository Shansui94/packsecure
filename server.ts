import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import chatHandler from './api/agent/chat';
import sopAssistantHandler from './api/agent/sop-assistant';
import manageEmployeeHandler from './api/manage-employee';
import visionHandler from './api/agent/vision';
import geocodeHandler from './api/geocode';
import aiPhotoHandler from './api/agent/ai-photo';
import lorryLatestMileageHandler from './api/lorry-latest-mileage';
import v2DocumentsHandler, {
    handleProcess as documentProcessHandler,
    handleDashboardMetrics as dashboardMetricsHandler,
    handleEntities as documentEntitiesHandler,
    handleLogs as documentLogsHandler
} from './api/v2-documents';

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

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
mountVercelHandler('/api/lorry-latest-mileage', lorryLatestMileageHandler);
mountVercelHandler('/api/v2-documents', v2DocumentsHandler);
mountVercelHandler('/api/v2/documents/process', documentProcessHandler);
mountVercelHandler('/api/v2/documents/dashboard-metrics', dashboardMetricsHandler);
mountVercelHandler('/api/v2/documents/entities', documentEntitiesHandler);
mountVercelHandler('/api/v2/documents/logs', documentLogsHandler);
mountVercelHandler('/api/agent/sop-assistant', sopAssistantHandler);

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
    console.log(`   - SOP Assistant:  http://localhost:${PORT}/api/agent/sop-assistant`);
    console.log(`   - Vision:         http://localhost:${PORT}/api/agent/vision`);
    console.log(`   - HR / Drivers:   /api/manage-employee, /api/create-driver, /api/delete-driver`);
    console.log(`   - AI Model: Gemini 2.0 Flash (Validated)\n`);
});
