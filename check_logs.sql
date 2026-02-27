SELECT id, product_sku, lane_id, alarm_count FROM production_logs WHERE machine_id = 'T1.2-M01' ORDER BY created_at DESC LIMIT 5;
