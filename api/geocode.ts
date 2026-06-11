import { VercelRequest, VercelResponse } from '@vercel/node';
import { applyAdminCors } from './lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    applyAdminCors(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { lat, lng } = req.body;

        if (lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'Missing coordinates: lat and lng are required.' });
        }

        const latitude = parseFloat(String(lat));
        const longitude = parseFloat(String(lng));

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates: lat and lng must be numbers.' });
        }

        // Call Nominatim Reverse Geocoding API
        // Usage policy requires a descriptive User-Agent
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PacksecureOS-App/1.1 (contact: support@packsecure.com)',
                'Accept-Language': 'en,ms;q=0.9'
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim returned HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        let addressText = '';

        if (data.address) {
            const addr = data.address;
            const parts: string[] = [];
            const addPart = (val: string) => {
                if (val && !parts.some(p => p.toLowerCase().trim() === val.toLowerCase().trim())) {
                    parts.push(val.trim());
                }
            };

            // 1. Road/Pedestrian/Building
            if (addr.road) addPart(addr.road);
            else if (addr.pedestrian) addPart(addr.pedestrian);
            else if (addr.industrial) addPart(addr.industrial);
            else if (addr.commercial) addPart(addr.commercial);

            // 2. Suburb / Neighborhood
            if (addr.suburb) addPart(addr.suburb);
            if (addr.neighbourhood) addPart(addr.neighbourhood);
            if (addr.village) addPart(addr.village);

            // 3. City / Town
            const cityOrTown = addr.city || addr.town || addr.municipality || addr.county;
            if (cityOrTown) addPart(cityOrTown);

            // 4. State
            if (addr.state) addPart(addr.state);

            addressText = parts.join(', ');
        }

        // Fallback to display_name if address formatting failed
        if (!addressText && data.display_name) {
            addressText = data.display_name;
        }

        if (!addressText) {
            addressText = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
        }

        return res.status(200).json({
            success: true,
            address: addressText,
            raw: {
                display_name: data.display_name,
                address: data.address
            }
        });

    } catch (e: any) {
        console.error('Reverse Geocode Error:', e);
        return res.status(500).json({ 
            success: false, 
            error: e.message || 'Failed to resolve address' 
        });
    }
}
