import fs from 'fs';
import path from 'path';

const urls = [
    'https://kdahubyhwndgyloaljak.supabase.co/storage/v1/object/public/work-photos/unload_do_DO-Ameer-260914-002_1789445689720.jpg',
    'https://kdahubyhwndgyloaljak.supabase.co/storage/v1/object/public/work-photos/unload_do_DO-Taufik-260914-001_1789451765384.jpg',
    'https://kdahubyhwndgyloaljak.supabase.co/storage/v1/object/public/work-photos/unload_do_DO-Yashin-260914-002_1789456293182.jpg',
    'https://kdahubyhwndgyloaljak.supabase.co/storage/v1/object/public/work-photos/unload_do_DO-HQ-260914-001_1789436274304.jpg'
];

async function downloadImages() {
    const outDir = path.resolve('scripts', 'sample_dos');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`Downloading sample DO ${i + 1}: ${url}`);
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Failed to download ${url}: ${res.statusText}`);
            continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const filePath = path.join(outDir, `sample_do_${i + 1}.jpg`);
        fs.writeFileSync(filePath, buf);
        console.log(`Saved to ${filePath} (${buf.length} bytes)`);
    }
}

downloadImages().catch(console.error);
