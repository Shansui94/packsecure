import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function emulateFetchData() {
    const selectedEmployeeId = 'ffeb9b0a-0d32-41f2-ba81-f2257ba45c17'; // Ayam auth_user_id
    const selectedMonth = 3;
    const selectedYear = 2026;
    const today = new Date();
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDayStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const startDateTs = new Date(`${firstDay}T00:00:00.000Z`).toISOString();
    const endDateTs = new Date(`${lastDayStr}T23:59:59.999Z`).toISOString();

    const { data: profileData } = await supabase
        .from('sys_users_v2')
        .select('*')
        .eq('auth_user_id', selectedEmployeeId)
        .single();
    
    console.log("Profile Data:", profileData?.name, profileData?.role);

    const isDriverProfile = profileData?.role === 'Driver';
    
    if (isDriverProfile) {
        console.log("Fetching deliveries...");
        const { data: deliveryData, error: dErr } = await supabase
            .from('sales_orders')
            .select('id, order_number, status, order_date, pod_timestamp, zone, delivery_zone, trip_origin, trip_drop_count')
            .eq('driver_id', selectedEmployeeId)
            .or(`pod_timestamp.gte.${startDateTs},order_date.gte.${firstDay}`);
        
        console.log("Raw Fetched count:", deliveryData?.length, "Error:", dErr);

        const validDeliveries = (deliveryData || []).filter(d => {
            if (d.status === 'Delivered' && d.pod_timestamp) {
                return d.pod_timestamp >= startDateTs && d.pod_timestamp <= endDateTs;
            }
            if (d.order_date) {
                const od = d.order_date.split('T')[0];
                return od >= firstDay && od <= lastDayStr;
            }
            return false;
        });

        console.log("Filtered Valid Deliveries count:", validDeliveries.length);

        if (validDeliveries.length > 0) {
            console.log("Sample matched order dates:", validDeliveries.map(d => ({ od: d.order_date, pod: d.pod_timestamp, status: d.status })).slice(0, 5));
        }
    } else {
        console.log("Not a driver.");
    }
}

emulateFetchData();
