-- Migration: Add Kelantan and Johor Factories, Machines, and Initial Delivery Rates

-- 1. Insert Factory entries for Kelantan (K1) and Johor (J1) into sys_factories_v2
INSERT INTO public.sys_factories_v2 (factory_id, name, address) VALUES
('K1', 'Kelantan Base (Kota Bharu)', 'Kelantan'),
('J1', 'Johor Base (Senai / JB)', 'Johor')
ON CONFLICT (factory_id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address;

-- 2. Seed initial machines for K1 and J1 in sys_machines_v2
INSERT INTO public.sys_machines_v2 (machine_id, name, type, factory_id, status) VALUES
('K1-M01', '1M Double Layer (K1)', 'Extruder', 'K1', 'Idle'),
('K1-M02', '1M Single Layer (K1)', 'Extruder', 'K1', 'Idle'),
('J1-M01', '2M Double Layer (J1)', 'Extruder', 'J1', 'Idle'),
('J1-M02', '1M Single Layer (J1)', 'Extruder', 'J1', 'Idle')
ON CONFLICT (machine_id) DO UPDATE SET
    name = EXCLUDED.name,
    factory_id = EXCLUDED.factory_id;

-- 3. Insert initial delivery rates for Origin: KELANTAN
INSERT INTO public.delivery_rates (origin, location_name, base_rate, max_places, extra_rate_per_place) VALUES
('KELANTAN', 'KOTA BHARU', 20, 1, 5),
('KELANTAN', 'PASIR MAS', 30, 1, 5),
('KELANTAN', 'TUMPAT', 30, 1, 5),
('KELANTAN', 'PASIR PUTEH', 40, 1, 5),
('KELANTAN', 'BACHOK', 30, 1, 5),
('KELANTAN', 'MACHANG', 40, 1, 10),
('KELANTAN', 'TANAH MERAH', 50, 1, 10),
('KELANTAN', 'KUALA KRAI', 60, 1, 10),
('KELANTAN', 'JELI', 80, 1, 10),
('KELANTAN', 'GUA MUSANG', 160, 1, 10),
('KELANTAN', 'AMBIK PALLET', 10, 0, 0),
('KELANTAN', 'LORRY SERVICE', 15, 0, 0)
ON CONFLICT (origin, location_name) DO UPDATE SET
    base_rate = EXCLUDED.base_rate,
    max_places = EXCLUDED.max_places,
    extra_rate_per_place = EXCLUDED.extra_rate_per_place;

-- 4. Insert initial delivery rates for Origin: JOHOR
INSERT INTO public.delivery_rates (origin, location_name, base_rate, max_places, extra_rate_per_place) VALUES
('JOHOR', 'WEHENG', 40, 1, 0),
('JOHOR', 'JB', 40, 1, 10),
('JOHOR', 'JOHOR BAHRU', 40, 1, 10),
('JOHOR', 'KULAI', 30, 1, 10),
('JOHOR', 'KOTA TINGGI', 50, 1, 10),
('JOHOR', 'PONTIAN', 60, 1, 10),
('JOHOR', 'BATU PAHAT', 90, 1, 10),
('JOHOR', 'KLUANG', 90, 1, 10),
('JOHOR', 'MUAR', 120, 1, 10),
('JOHOR', 'TANGKAK', 120, 1, 10),
('JOHOR', 'SEGAMAT', 130, 1, 10),
('JOHOR', 'MERSING', 130, 1, 10),
('JOHOR', 'AMBIK PALLET', 10, 0, 0),
('JOHOR', 'LORRY SERVICE', 15, 0, 0)
ON CONFLICT (origin, location_name) DO UPDATE SET
    base_rate = EXCLUDED.base_rate,
    max_places = EXCLUDED.max_places,
    extra_rate_per_place = EXCLUDED.extra_rate_per_place;

-- 5. Seed sys_locations_v2 for Johor and Kelantan
INSERT INTO public.sys_locations_v2 (loc_id, name, type, factory_id) VALUES
('Johor', 'Johor', 'Warehouse', 'J1'),
('JOHOR', 'Johor', 'Warehouse', 'J1'),
('Kelantan', 'Kelantan', 'Warehouse', 'K1'),
('KELANTAN', 'Kelantan', 'Warehouse', 'K1')
ON CONFLICT (loc_id) DO UPDATE SET
    name = EXCLUDED.name,
    factory_id = EXCLUDED.factory_id;

