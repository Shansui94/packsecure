-- 这是一个数据导入脚本。它会将您以前的各种核心操作（入库、生产、出库等）批量迁移到新开设的 Activity Logs 当中。

-- 1. 导入库存记录 (Stock Ledger) - 通常覆盖管理员的出入库
INSERT INTO public.user_activity_logs (user_id, email, name, role, action, details, created_at)
SELECT 
    l.created_by::uuid as user_id,
    u.email as email,
    COALESCE(u.name, l.created_by_name) as name,
    u.role as role,
    CASE 
        WHEN l.event_type = 'PRODUCTION' THEN 'CREATE_PRODUCTION'
        WHEN l.event_type = 'DISPATCH' THEN 'DISPATCH_STOCK'
        ELSE 'UPDATE_INVENTORY'
    END as action,
    jsonb_build_object(
        'sku', l.sku, 
        'change_qty', l.change_qty, 
        'location', l.loc_id, 
        'notes', l.notes,
        'imported', true
    ) as details,
    l.timestamp as created_at
FROM public.stock_ledger_v2 l
LEFT JOIN public.sys_users_v2 u ON u.auth_user_id::text = l.created_by::text
WHERE l.created_by IS NOT NULL AND (l.created_by::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. 导入您的工作笔记/任务 (Tasks/Notes Eğer varsa) - 通常覆盖各种角色的任务协作
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='created_by') THEN
        INSERT INTO public.user_activity_logs (user_id, email, name, role, action, details, created_at)
        SELECT 
            t.created_by::uuid as user_id,
            u.email,
            u.name,
            u.role,
            'CREATE_TASK' as action,
            jsonb_build_object('title', t.title, 'status', t.status, 'imported', true) as details,
            t.created_at
        FROM public.tasks t
        LEFT JOIN public.sys_users_v2 u ON u.auth_user_id::text = t.created_by::text
        WHERE t.created_by IS NOT NULL AND (t.created_by::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    END IF;
END $$;

-- 3. ★ 导入操作员的生产记录 (Production Logs V2) ★
INSERT INTO public.user_activity_logs (user_id, email, name, role, action, details, created_at)
SELECT 
    p.operator_id::uuid as user_id,
    u.email,
    u.name,
    u.role,
    'SUBMIT_PRODUCTION' as action,
    jsonb_build_object(
        'job_id', p.job_id,
        'machine', p.machine_id,
        'output', p.output_qty,
        'imported', true
    ) as details,
    p.created_at
FROM public.production_logs_v2 p
LEFT JOIN public.sys_users_v2 u ON u.auth_user_id::text = p.operator_id::text
WHERE p.operator_id IS NOT NULL AND (p.operator_id::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 4. ★ 导入司机的派送历史 (Lorry Service 如果有的话) ★
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='lorry_service') THEN
        INSERT INTO public.user_activity_logs (user_id, email, name, role, action, details, created_at)
        SELECT 
            ls.driver_id::uuid as user_id,
            u.email,
            u.name,
            u.role,
            'LORRY_SERVICE_RECORD' as action,
            jsonb_build_object(
                'lorry', ls.lorry_plate,
                'service_type', ls.service_type,
                'imported', true
            ) as details,
            ls.created_at
        FROM public.lorry_service ls
        LEFT JOIN public.sys_users_v2 u ON u.auth_user_id::text = ls.driver_id::text
        WHERE ls.driver_id IS NOT NULL AND (ls.driver_id::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    END IF;
END $$;
