import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import chatHandler from './api/agent/chat';
import manageEmployeeHandler from './api/manage-employee';
import visionHandler from './api/agent/vision';
import geocodeHandler from './api/geocode';
import aiPhotoHandler from './api/agent/ai-photo';
import universalHandler, { handleIntake, handleQuery, handleParseText, handleParseTripPdf, handleSopAssistant } from './api/agent/universal';
import iotConfigHandler, { handleMachines, handleAlarm } from './api/iot-config';
import lorryLatestMileageHandler from './api/lorry-latest-mileage';
import v2DocumentsHandler, {
    handleProcess as documentProcessHandler,
    handleDashboardMetrics as dashboardMetricsHandler,
    handleEntities as documentEntitiesHandler,
    handleLogs as documentLogsHandler
} from './api/v2-documents';
import docsHandler, { handleDevLog } from './api/docs';
import whatsappHandler, { handleWhatsAppSend, handleWhatsAppWebhook } from './api/whatsapp';
import nightlyReportHandler from './api/cron/nightly-report';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

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
mountVercelHandler('/api/agent/universal', universalHandler);
mountVercelHandler('/api/agent/universal-intake', handleIntake);
mountVercelHandler('/api/agent/universal-query', handleQuery);
mountVercelHandler('/api/agent/parse-text', handleParseText);
mountVercelHandler('/api/iot-config', iotConfigHandler);
mountVercelHandler('/api/machines', handleMachines);
mountVercelHandler('/api/alarm', handleAlarm);
mountVercelHandler('/api/lorry-latest-mileage', lorryLatestMileageHandler);
mountVercelHandler('/api/v2-documents', v2DocumentsHandler);
mountVercelHandler('/api/v2/documents/process', documentProcessHandler);
mountVercelHandler('/api/v2/documents/dashboard-metrics', dashboardMetricsHandler);
mountVercelHandler('/api/v2/documents/entities', documentEntitiesHandler);
mountVercelHandler('/api/v2/documents/logs', documentLogsHandler);
mountVercelHandler('/api/agent/sop-assistant', handleSopAssistant);
mountVercelHandler('/api/docs', docsHandler);
mountVercelHandler('/api/dev-log', handleDevLog);
mountVercelHandler('/api/whatsapp', whatsappHandler);
mountVercelHandler('/api/whatsapp/send', handleWhatsAppSend);
mountVercelHandler('/api/whatsapp/webhook', handleWhatsAppWebhook);
mountVercelHandler('/api/cron/nightly-report', nightlyReportHandler);
mountVercelHandler('/api/agent/parse-trip-pdf', handleParseTripPdf);
mountVercelHandler('/api/agent/omni-command', async (req, res) => {
    req.query = req.query || {};
    req.query.action = 'omni-command';
    return universalHandler(req, res);
});

// Tutorial Video Upload Endpoint (Local dev)
const tutorialVideoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), 'public', 'videos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const type = req.body?.videoType || req.query?.type || 'delivery';
        const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
        const baseName = type === 'monthly' ? 'driver_monthly_check_tutorial' : 'driver_delivery_tutorial';
        cb(null, `${baseName}${ext}`);
    }
});
const tutorialVideoUpload = multer({ storage: tutorialVideoStorage, limits: { fileSize: 500 * 1024 * 1024 } });

app.post('/api/upload-tutorial-video', tutorialVideoUpload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
    }
    console.log(`[API] Uploaded tutorial video: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    res.json({ success: true, filename: req.file.filename, size: req.file.size });
});

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
