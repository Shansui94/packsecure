export interface PrepPhoto {
    url: string;
    location: string;
}

/**
 * Parses the preparation_photo_url field from sales_orders.
 * Supports legacy single image URL strings, comma-separated image URLs,
 * and the new JSON-stringified array of { url: string, location: string }.
 */
export const parsePrepPhotos = (photoField?: string | null): PrepPhoto[] => {
    if (!photoField) return [];
    
    const trimmed = photoField.trim();
    if (!trimmed) return [];

    try {
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((item: any) => {
                    if (typeof item === 'string') {
                        return { url: item, location: 'General' };
                    }
                    return { 
                        url: item.url || '', 
                        location: item.location || 'General' 
                    };
                }).filter(item => item.url);
            }
        }
    } catch (e) {
        console.warn("Failed to parse preparation_photo_url as JSON array, falling back to legacy parsing:", e);
    }

    // Fallback: handle legacy comma-separated URLs or single URL
    return trimmed
        .split(',')
        .map(url => ({ url: url.trim(), location: 'General' }))
        .filter(item => item.url);
};

/**
 * Stringifies the PrepPhoto array back to a JSON string for database storage.
 */
export const stringifyPrepPhotos = (photos: PrepPhoto[]): string => {
    return JSON.stringify(photos.filter(p => p.url));
};
