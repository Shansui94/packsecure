import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const sb = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const items = [
    { sku: 'W-BUBBLE-ENVELOPE-11X13', name: 'WHITE BUBBLE ENVELOPE 11 X 13+4 (1950PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-13X15', name: 'WHITE BUBBLE ENVOLOPE 13 X 15+4 (1300PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-14X16', name: 'WHITE BUBBLE ENVOLOPE 14 X 16+4 (1050PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-18X23', name: 'WHITE BUBBLE ENVOLOPE 18 X 23+4 (600PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-20X25', name: 'WHITE BUBBLE ENVOLOPE 20 X 25+4 (480PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-23X28', name: 'WHITE BUBBLE ENVOLOPE 23 X 28+4 (350PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-26X32', name: 'WHITE BUBBLE ENVOLOPE 26 X 32+4 (300PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-29X36', name: 'WHITE BUBBLE ENVOLOPE 29 X 36+4 (250PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-35X45', name: 'WHITE BUBBLE ENVOLOPE 35 X 45+4 (150PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
    { sku: 'W-BUBBLE-ENVOLOPE-40X50', name: 'WHITE BUBBLE ENVOLOPE 40 X 50+4 (120PCS/CTN)', type: 'FG', supply_type: 'Purchased', status: 'Active', uom: 'UNIT' },
];

const { error } = await sb.from('master_items_v2').upsert(items, { onConflict: 'sku' });

if (error) {
    console.error('❌ ERROR:', error.message);
} else {
    console.log(`✅ Inserted/updated ${items.length} bubble envelope items.`);
    items.forEach(i => console.log(`  - ${i.sku}`));
}
