-- Fix missing PINs for 14 Users
-- Target Table: sys_users_v2 (Based on debug_pins.ts and apiV2.ts)
-- Defaulting PIN to '0000' for drivers to reset.

-- 1. Dean (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'eab6064a-55a9-42ab-92a5-dac237392bc9' OR auth_user_id = 'eab6064a-55a9-42ab-92a5-dac237392bc9';

-- 2. WAN (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'b83f0d0b-81cd-49e9-889e-8f6cea5d0da8' OR auth_user_id = 'b83f0d0b-81cd-49e9-889e-8f6cea5d0da8';

-- 3. Ameer (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'db4bca04-8d15-46fe-913b-50b17f28ebcd' OR auth_user_id = 'db4bca04-8d15-46fe-913b-50b17f28ebcd';

-- 4. Faizal (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = '88577b56-900b-4028-bd29-0164b4139bb2' OR auth_user_id = '88577b56-900b-4028-bd29-0164b4139bb2';

-- 5. Waldan (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'ffe2d44c-b9a0-439e-8471-458e2388a908' OR auth_user_id = 'ffe2d44c-b9a0-439e-8471-458e2388a908';

-- 6. Yashin (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = '8274bd20-fa44-4121-be67-b6e8b8c8b2d7' OR auth_user_id = '8274bd20-fa44-4121-be67-b6e8b8c8b2d7';

-- 7. Alif (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = '6d79a3d4-7947-4e5b-9ec6-d91206a1345d' OR auth_user_id = '6d79a3d4-7947-4e5b-9ec6-d91206a1345d';

-- 8. SAM (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'd166c7bc-c01f-45f5-ad03-6202c65f91e2' OR auth_user_id = 'd166c7bc-c01f-45f5-ad03-6202c65f91e2';

-- 9. Mahadi (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'a5f86151-c2ca-4538-a785-d35035d69c05' OR auth_user_id = 'a5f86151-c2ca-4538-a785-d35035d69c05';

-- 10. Tahir (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'ed5fcd9b-afda-4582-b7c8-8dd3844855b5' OR auth_user_id = 'ed5fcd9b-afda-4582-b7c8-8dd3844855b5';

-- 11. Ayam (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'b8f72c63-e20b-4588-8f82-e1c20ab4b83a' OR auth_user_id = 'b8f72c63-e20b-4588-8f82-e1c20ab4b83a';

-- 12. Bob (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = 'd005d4ec-19c0-4318-96b1-8cf9d988d1f0' OR auth_user_id = 'd005d4ec-19c0-4318-96b1-8cf9d988d1f0';

-- 13. General Customer (Driver)
UPDATE sys_users_v2 SET pin_code = '0000' WHERE id = '5c3558ab-72ab-4f7e-b3ec-85124d7973db' OR auth_user_id = '5c3558ab-72ab-4f7e-b3ec-85124d7973db';

-- 14. Vivian (Admin)
UPDATE sys_users_v2 SET pin_code = '8888' WHERE id = '6022ceb0-7046-468a-bca4-02873a240815' OR auth_user_id = '6022ceb0-7046-468a-bca4-02873a240815';

-- Verification
SELECT id, name, pin_code FROM sys_users_v2 WHERE pin_code IS NULL;
