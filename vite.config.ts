import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'sop-assistant-api-dev-middleware',
            configureServer(server) {
                server.middlewares.use('/api/agent/sop-assistant', async (req, res, next) => {
                    if (req.method !== 'POST') return next();
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', async () => {
                        try {
                            const parsedBody = JSON.parse(body || '{}');
                            const shimReq: any = req;
                            shimReq.body = parsedBody;

                            const shimRes: any = res;
                            shimRes.status = (code: number) => {
                                shimRes.statusCode = code;
                                return shimRes;
                            };
                            shimRes.json = (data: any) => {
                                shimRes.setHeader('Content-Type', 'application/json');
                                shimRes.end(JSON.stringify(data));
                                return shimRes;
                            };

                            const { handleSopAssistant } = await import('./api/agent/universal');
                            await handleSopAssistant(shimReq, shimRes);
                        } catch (err: any) {
                            console.error('[Vite SOP API Error]:', err);
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: false, error: err.message }));
                        }
                    });
                });
            }
        }
    ],
    server: {
        host: true, // Exposes to LAN (0.0.0.0)
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true
            }
        }
    },
    build: {
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('jspdf') || id.includes('html2canvas')) {
                            return 'vendor-pdf';
                        }
                        if (id.includes('leaflet')) {
                            return 'vendor-maps';
                        }
                        if (id.includes('recharts') || id.includes('d3-')) {
                            return 'vendor-charts';
                        }
                        if (id.includes('konva')) {
                            return 'vendor-canvas';
                        }
                        if (id.includes('@google/genai') || id.includes('@google/generative-ai')) {
                            return 'vendor-ai';
                        }
                        if (id.includes('@yudiel/react-qr-scanner') || id.includes('react-qr-code') || id.includes('react-webcam')) {
                            return 'vendor-scanner';
                        }
                        if (id.includes('@dnd-kit') || id.includes('@hello-pangea/dnd')) {
                            return 'vendor-dnd';
                        }
                        if (id.includes('@supabase/supabase-js')) {
                            return 'vendor-supabase';
                        }
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons';
                        }
                        if (id.includes('xlsx')) {
                            return 'vendor-excel';
                        }
                        if (id.includes('react') || id.includes('react-dom') || id.includes('i18next')) {
                            return 'vendor-framework';
                        }
                    }
                }


            }
        }
    }
})

