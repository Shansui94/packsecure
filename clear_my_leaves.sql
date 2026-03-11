-- Run this in the Supabase SQL Editor to forcefully clear all leave records for khailoon94

-- 1. Find the local auth_user_id(s) for the user named 'khailoon94'
-- 2. Delete all records in employee_leave that match those IDs

DELETE FROM public.employee_leave
WHERE employee_id IN (
    SELECT auth_user_id 
    FROM public.sys_users_v2 
    WHERE name ILIKE '%khailoon%'
);

-- Note: Also delete any that might be explicitly linked to string 'khailoon94' just in case

