-- Migration: Add physical indexes to stock_ledger and RPC functions for lightning-fast deterministic reconciliation
-- Date: 2026-09-22

-- 1. Create essential indexes on physical table stock_ledger
CREATE INDEX IF NOT EXISTS idx_stock_ledger_sku_timestamp 
ON stock_ledger (sku, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_loc_timestamp 
ON stock_ledger (loc_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_event_type 
ON stock_ledger (event_type);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_loc_sku_event 
ON stock_ledger (loc_id, sku, event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_timestamp 
ON stock_ledger (timestamp DESC);

-- 2. Flow RPC for period-based summary
CREATE OR REPLACE FUNCTION public.get_stock_reconciliation_flow(
    p_loc_id text DEFAULT NULL,
    p_start_time timestamptz DEFAULT NULL,
    p_end_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
    sku character varying,
    event_type character varying,
    total_qty numeric,
    total_txs bigint
) LANGUAGE sql STABLE AS $$
    SELECT 
        sku,
        event_type,
        COALESCE(SUM(change_qty), 0) as total_qty,
        COUNT(*) as total_txs
    FROM stock_ledger
    WHERE 
        (p_loc_id IS NULL OR p_loc_id = 'ALL' OR loc_id = p_loc_id)
        AND (p_start_time IS NULL OR timestamp >= p_start_time)
        AND (p_end_time IS NULL OR timestamp <= p_end_time)
    GROUP BY sku, event_type;
$$;

GRANT EXECUTE ON FUNCTION public.get_stock_reconciliation_flow(text, timestamptz, timestamptz) TO anon, authenticated, service_role;

-- 3. Daily breakdown RPC for single SKU drilldown
CREATE OR REPLACE FUNCTION public.get_sku_reconciliation_daily(
    p_sku text,
    p_loc_id text DEFAULT NULL,
    p_start_time timestamptz DEFAULT NULL,
    p_end_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
    day text,
    production_qty numeric,
    delivery_qty numeric,
    transfer_in_qty numeric,
    other_qty numeric,
    tx_count bigint
) LANGUAGE sql STABLE AS $$
    SELECT 
        to_char(timestamp AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD') as day,
        COALESCE(SUM(CASE WHEN event_type = 'Production' THEN change_qty ELSE 0 END), 0) as production_qty,
        COALESCE(SUM(CASE WHEN event_type = 'Transfer Out' THEN ABS(change_qty) ELSE 0 END), 0) as delivery_qty,
        COALESCE(SUM(CASE WHEN event_type = 'Transfer In' THEN change_qty ELSE 0 END), 0) as transfer_in_qty,
        COALESCE(SUM(CASE WHEN event_type NOT IN ('Production', 'Transfer Out', 'Transfer In') AND event_type NOT ILIKE '%Audit%' THEN change_qty ELSE 0 END), 0) as other_qty,
        COUNT(*) as tx_count
    FROM stock_ledger
    WHERE 
        sku = p_sku
        AND (p_loc_id IS NULL OR p_loc_id = 'ALL' OR loc_id = p_loc_id)
        AND (p_start_time IS NULL OR timestamp >= p_start_time)
        AND (p_end_time IS NULL OR timestamp <= p_end_time)
    GROUP BY to_char(timestamp AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD')
    ORDER BY day ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sku_reconciliation_daily(text, text, timestamptz, timestamptz) TO anon, authenticated, service_role;

-- 4. Warehouse multi-mode reconciliation summary RPC
CREATE OR REPLACE FUNCTION public.get_warehouse_reconciliation_summary(
    p_loc_id text DEFAULT 'OPM Lama',
    p_mode text DEFAULT 'CLOSED_AUDIT',
    p_start_time timestamptz DEFAULT NULL,
    p_end_time timestamptz DEFAULT NULL
)
RETURNS TABLE (
    sku character varying,
    loc_id character varying,
    start_time timestamptz,
    end_time timestamptz,
    start_stock numeric,
    actual_stock numeric,
    prod_qty numeric,
    deliv_qty numeric,
    transfer_in_qty numeric,
    other_qty numeric,
    tx_count bigint,
    has_closed_audit boolean,
    has_any_audit boolean
) LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_now timestamptz := now();
    v_start timestamptz := COALESCE(p_start_time, v_now - interval '30 days');
    v_end timestamptz := COALESCE(p_end_time, v_now);
BEGIN
    IF p_mode = 'CLOSED_AUDIT' THEN
        RETURN QUERY
        WITH ranked_audits AS (
            SELECT 
                sl.sku,
                sl.loc_id,
                sl.timestamp as audit_time,
                sl.notes,
                sl.balance_after,
                sl.change_qty,
                ROW_NUMBER() OVER (PARTITION BY sl.sku, sl.loc_id ORDER BY sl.timestamp DESC) as rn,
                COUNT(*) OVER (PARTITION BY sl.sku, sl.loc_id) as total_audits
            FROM stock_ledger sl
            WHERE sl.event_type ILIKE '%Audit%'
              AND (p_loc_id IS NULL OR p_loc_id = 'ALL' OR sl.loc_id = p_loc_id)
        ),
        closed_pairs AS (
            SELECT 
                a1.sku,
                a1.loc_id,
                a2.audit_time as s_time,
                a1.audit_time as e_time,
                COALESCE(
                    NULLIF(substring(a2.notes from 'Actual\\s*:\\s*([0-9.-]+)'), '')::numeric,
                    NULLIF(substring(a2.notes from 'Base\\s*=\\s*([0-9.-]+)'), '')::numeric,
                    a2.balance_after,
                    a2.change_qty,
                    0
                ) as s_stock,
                COALESCE(
                    NULLIF(substring(a1.notes from 'Actual\\s*:\\s*([0-9.-]+)'), '')::numeric,
                    NULLIF(substring(a1.notes from 'Base\\s*=\\s*([0-9.-]+)'), '')::numeric,
                    a1.balance_after,
                    a1.change_qty,
                    0
                ) as a_stock,
                true as is_closed,
                true as has_any
            FROM ranked_audits a1
            JOIN ranked_audits a2 ON a1.sku = a2.sku AND a1.loc_id = a2.loc_id AND a2.rn = 2
            WHERE a1.rn = 1
        ),
        single_audits AS (
            SELECT 
                a1.sku,
                a1.loc_id,
                a1.audit_time as s_time,
                v_now as e_time,
                COALESCE(
                    NULLIF(substring(a1.notes from 'Actual\\s*:\\s*([0-9.-]+)'), '')::numeric,
                    NULLIF(substring(a1.notes from 'Base\\s*=\\s*([0-9.-]+)'), '')::numeric,
                    a1.balance_after,
                    a1.change_qty,
                    0
                ) as s_stock,
                COALESCE(
                    NULLIF(substring(a1.notes from 'Actual\\s*:\\s*([0-9.-]+)'), '')::numeric,
                    NULLIF(substring(a1.notes from 'Base\\s*=\\s*([0-9.-]+)'), '')::numeric,
                    a1.balance_after,
                    a1.change_qty,
                    0
                ) as a_stock,
                false as is_closed,
                true as has_any
            FROM ranked_audits a1
            WHERE a1.rn = 1 AND a1.total_audits = 1
        ),
        combined_targets AS (
            SELECT * FROM closed_pairs
            UNION ALL
            SELECT * FROM single_audits
        )
        SELECT 
            ct.sku,
            ct.loc_id,
            ct.s_time as start_time,
            ct.e_time as end_time,
            ct.s_stock as start_stock,
            ct.a_stock as actual_stock,
            COALESCE(SUM(CASE WHEN l.event_type = 'Production' THEN l.change_qty ELSE 0 END), 0)::numeric as prod_qty,
            COALESCE(SUM(CASE WHEN l.event_type = 'Transfer Out' THEN ABS(l.change_qty) ELSE 0 END), 0)::numeric as deliv_qty,
            COALESCE(SUM(CASE WHEN l.event_type = 'Transfer In' THEN l.change_qty ELSE 0 END), 0)::numeric as transfer_in_qty,
            COALESCE(SUM(CASE WHEN l.event_type NOT IN ('Production', 'Transfer Out', 'Transfer In') AND l.event_type NOT ILIKE '%Audit%' THEN l.change_qty ELSE 0 END), 0)::numeric as other_qty,
            COUNT(l.txn_id)::bigint as tx_count,
            ct.is_closed as has_closed_audit,
            ct.has_any as has_any_audit
        FROM combined_targets ct
        LEFT JOIN stock_ledger l ON l.sku = ct.sku 
            AND l.loc_id = ct.loc_id 
            AND l.timestamp >= ct.s_time 
            AND l.timestamp <= ct.e_time
        GROUP BY ct.sku, ct.loc_id, ct.s_time, ct.e_time, ct.s_stock, ct.a_stock, ct.is_closed, ct.has_any
        ORDER BY ct.sku;

    ELSE
        -- Bounded range mode (THIS_MONTH, LAST_7D, LAST_30D, CUSTOM, AUDIT_TO_NOW)
        RETURN QUERY
        SELECT 
            l.sku,
            l.loc_id,
            v_start as start_time,
            v_end as end_time,
            0::numeric as start_stock,
            0::numeric as actual_stock,
            COALESCE(SUM(CASE WHEN l.event_type = 'Production' THEN l.change_qty ELSE 0 END), 0)::numeric as prod_qty,
            COALESCE(SUM(CASE WHEN l.event_type = 'Transfer Out' THEN ABS(l.change_qty) ELSE 0 END), 0)::numeric as deliv_qty,
            COALESCE(SUM(CASE WHEN l.event_type = 'Transfer In' THEN l.change_qty ELSE 0 END), 0)::numeric as transfer_in_qty,
            COALESCE(SUM(CASE WHEN l.event_type NOT IN ('Production', 'Transfer Out', 'Transfer In') AND l.event_type NOT ILIKE '%Audit%' THEN l.change_qty ELSE 0 END), 0)::numeric as other_qty,
            COUNT(l.txn_id)::bigint as tx_count,
            false as has_closed_audit,
            false as has_any_audit
        FROM stock_ledger l
        WHERE 
            (p_loc_id IS NULL OR p_loc_id = 'ALL' OR l.loc_id = p_loc_id)
            AND l.timestamp >= v_start
            AND l.timestamp <= v_end
        GROUP BY l.sku, l.loc_id
        ORDER BY l.sku;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_reconciliation_summary(text, text, timestamptz, timestamptz) TO anon, authenticated, service_role;
