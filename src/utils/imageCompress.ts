/** Resize and compress a photo for vision API upload (keeps under Vercel body limits). */
export function compressImage(file: File, maxWidth = 2048, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = (maxWidth / w) * h;
                    w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas not supported'));
                    return;
                }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            if (e.target?.result) {
                img.src = e.target.result as string;
            } else {
                reject(new Error('File processing failed'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/** data URL → raw base64 + mime for API */
export function dataUrlToBase64Payload(dataUrl: string): { base64: string; mimeType: string } {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
        return { mimeType: match[1], base64: match[2] };
    }
    return { mimeType: 'image/jpeg', base64: dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl };
}

/** Converts data URL (base64) to a Blob object without using window.fetch */
export function dataURLtoBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

/** Draws timestamp, order/type, and location banner at the bottom of a photo. */
export function watermarkImage(base64Str: string, textLines: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const w = img.width;
            const h = img.height;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;

            // Draw original image
            ctx.drawImage(img, 0, 0, w, h);

            // Add watermarking overlay
            const bannerHeight = Math.max(50, Math.floor(h * 0.12));
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black
            ctx.fillRect(0, h - bannerHeight, w, bannerHeight);

            // Font setup
            const fontSize = Math.max(12, Math.floor(bannerHeight / (textLines.length + 1)));
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = '#ffffff'; // White text
            ctx.textBaseline = 'top';

            // Draw text lines
            const paddingLeft = Math.max(15, Math.floor(w * 0.03));
            const totalTextHeight = textLines.length * fontSize * 1.25;
            const paddingTop = h - bannerHeight + (bannerHeight - totalTextHeight) / 2;

            textLines.forEach((line, index) => {
                let drawLine = line;
                const maxTextWidth = w - paddingLeft * 2;
                if (ctx.measureText(line).width > maxTextWidth) {
                    while (drawLine.length > 5 && ctx.measureText(drawLine + '...').width > maxTextWidth) {
                        drawLine = drawLine.slice(0, -1);
                    }
                    drawLine += '...';
                }
                ctx.fillText(drawLine, paddingLeft, paddingTop + (index * fontSize * 1.25));
            });

            // Output as Jpeg
            const watermarkedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(watermarkedDataUrl.split(',')[1]); // return just the base64 part
        };
        img.onerror = reject;
        img.src = `data:image/jpeg;base64,${base64Str}`;
    });
}

