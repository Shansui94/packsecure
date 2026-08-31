import 'dotenv/config';
import { handleProcess } from '../api/v2-documents';

async function test() {
    console.log('Testing handleProcess...');
    const mockPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    
    const req: any = {
        method: 'POST',
        body: {
            fileBase64: 'data:image/jpeg;base64,' + mockPngBase64,
            fileName: 'WhatsApp Image 2026-08-24 at 14.45.20.jpeg',
            mimeType: 'image/jpeg'
        }
    };
    
    const res: any = {
        statusCode: 200,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(data: any) {
            console.log('✅ Result Status:', this.statusCode);
            console.log('Data:', JSON.stringify(data, null, 2));
            return this;
        }
    };
    
    await handleProcess(req, res);
    console.log('Test completed successfully!');
}

test();
