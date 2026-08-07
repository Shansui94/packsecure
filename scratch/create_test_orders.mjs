import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
        env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
}
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const today = new Date().toISOString().split('T')[0];

const testOrders = [
    // TAIPING Warehouse Orders
    {
        order_number: "TEST-SO-TP-001",
        customer: "Alpha Plastic Taiping",
        delivery_address: "Jalan Kamunting, Kawasan Perusahaan Kamunting, 34600 Taiping, Perak",
        zone: "Perak",
        trip_origin: "TAIPING",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Bubble Wrap 1m x 50m", sku: "BW-SL-1.0-50", quantity: 5, sourceLocation: "OPM Lama" }]
    },
    {
        order_number: "TEST-SO-TP-002",
        customer: "Beta Electronics Ipoh",
        delivery_address: "Kawasan Perindustrian Jelapang, 30020 Ipoh, Perak",
        zone: "Perak",
        trip_origin: "TAIPING",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Stretch Film 2.4kg", sku: "SF-2.4", quantity: 20, sourceLocation: "SPD" }]
    },
    {
        order_number: "TEST-SO-TP-003",
        customer: "Gamma Manufacturing Penang",
        delivery_address: "Kawasan Perusahaan Bayan Lepas, 11900 Bayan Lepas, Penang",
        zone: "Penang",
        trip_origin: "TAIPING",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Bubble Wrap 1.2m x 100m", sku: "BW-SL-1.2-100", quantity: 15, sourceLocation: "OPM Lama" }]
    },
    {
        order_number: "TEST-SO-TP-004",
        customer: "Omega Logistics Butterworth",
        delivery_address: "Kawasan Perusahaan Mak Mandin, 13400 Butterworth, Penang",
        zone: "Penang",
        trip_origin: "TAIPING",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Stretch Film 2.4kg", sku: "SF-2.4", quantity: 50, sourceLocation: "SPD" }]
    },
    {
        order_number: "TEST-SO-TP-005",
        customer: "Delta Warehouse Kulim",
        delivery_address: "Kulim Hi-Tech Park, 09000 Kulim, Kedah",
        zone: "Kedah",
        trip_origin: "TAIPING",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Bubble Wrap 1m x 50m", sku: "BW-SL-1.0-50", quantity: 10, sourceLocation: "OPM Lama" }]
    },

    // NILAI Warehouse Orders
    {
        order_number: "TEST-SO-NL-001",
        customer: "Sigma Tech Shah Alam",
        delivery_address: "Persiaran Perusahaan, Seksyen 23, 40300 Shah Alam, Selangor",
        zone: "Selangor",
        trip_origin: "NILAI",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Stretch Film 2.4kg", sku: "SF-2.4", quantity: 30, sourceLocation: "Nilai" }]
    },
    {
        order_number: "TEST-SO-NL-002",
        customer: "Zeta Foods Rawang",
        delivery_address: "Kawasan Perusahaan Rawang, 48000 Rawang, Selangor",
        zone: "Selangor",
        trip_origin: "NILAI",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Bubble Wrap 1m x 50m", sku: "BW-SL-1.0-50", quantity: 8, sourceLocation: "Nilai" }]
    },
    {
        order_number: "TEST-SO-NL-003",
        customer: "Epsilon Logistics Puchong",
        delivery_address: "Jalan BP 4, Bandar Bukit Puchong, 47100 Puchong, Selangor",
        zone: "Selangor",
        trip_origin: "NILAI",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Stretch Film 2.4kg", sku: "SF-2.4", quantity: 12, sourceLocation: "Nilai" }]
    },
    {
        order_number: "TEST-SO-NL-004",
        customer: "Apex Industries Seremban",
        delivery_address: "Kawasan Perindustrian Senawang, 70450 Seremban, Negeri Sembilan",
        zone: "Negeri Sembilan",
        trip_origin: "NILAI",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Bubble Wrap 1.2m x 100m", sku: "BW-SL-1.2-100", quantity: 25, sourceLocation: "Nilai" }]
    },
    {
        order_number: "TEST-SO-NL-005",
        customer: "Vertex Warehousing JB",
        delivery_address: "Jalan Pasir Gudang, Kawasan Perindustrian Pasir Gudang, 81700 Pasir Gudang, Johor",
        zone: "Johor",
        trip_origin: "NILAI",
        status: "Pending",
        order_date: today,
        deadline: today,
        items: [{ product: "Stretch Film 2.4kg", sku: "SF-2.4", quantity: 40, sourceLocation: "Nilai" }]
    }
];

async function run() {
    console.log("Inserting 10 test orders...");
    const { data, error } = await supabase.from('sales_orders').insert(testOrders).select();
    if (error) {
        console.error("Error inserting test orders:", error);
    } else {
        console.log(`Successfully inserted ${data.length} test orders!`);
    }
}
run();
