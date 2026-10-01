import pg from 'pg';

const connectionString = 'postgresql://postgres.kdahubyhwndgyloaljak:%24QNQ4rAW*%23%25294z@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    await client.connect();

    const sql = `
    DROP FUNCTION IF EXISTS get_monthly_executive_trends(date, date);
    CREATE OR REPLACE FUNCTION get_monthly_executive_trends(start_date date, end_date date)
    RETURNS TABLE (
        month_str text,
        production_rolls numeric,
        scrap_kg numeric,
        recycle_kg numeric,
        delivered_rolls numeric,
        delivered_orders bigint,
        delivered_trips bigint,
        delivered_drops bigint,
        taiping_rolls numeric,
        nilai_rolls numeric,
        kelantan_rolls numeric,
        johor_rolls numeric
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    SET statement_timeout = '30s'
    AS $$
    BEGIN
        RETURN QUERY
        WITH prod AS (
            SELECT 
                to_char(created_at, 'YYYY-MM') as m,
                ROUND(SUM(CASE WHEN machine_id IN ('T5-M05', 'N3-M03', 'J1-M02') OR sku LIKE 'RM-REC%' OR sku LIKE 'REC-%' THEN 0 ELSE output_qty END)) as p_rolls,
                ROUND(SUM(reject_qty)::numeric, 1) as s_kg,
                ROUND(SUM(CASE WHEN machine_id IN ('T5-M05', 'N3-M03', 'J1-M02') OR sku LIKE 'RM-REC%' OR sku LIKE 'REC-%' THEN output_qty ELSE 0 END)::numeric, 1) as rec_kg,
                ROUND(SUM(CASE WHEN machine_id LIKE 'T%' AND machine_id NOT IN ('T5-M05') AND sku NOT LIKE 'RM-REC%' THEN output_qty ELSE 0 END)) as tp_rolls,
                ROUND(SUM(CASE WHEN machine_id LIKE 'N%' AND machine_id NOT IN ('N3-M03') AND sku NOT LIKE 'RM-REC%' THEN output_qty ELSE 0 END)) as nl_rolls,
                ROUND(SUM(CASE WHEN machine_id LIKE 'K%' THEN output_qty ELSE 0 END)) as kl_rolls,
                ROUND(SUM(CASE WHEN machine_id LIKE 'J%' AND machine_id NOT IN ('J1-M02') THEN output_qty ELSE 0 END)) as jh_rolls
            FROM production_logs
            WHERE created_at >= start_date AND created_at <= (end_date + INTERVAL '1 day')
            GROUP BY 1
        ),
        deliv_rolls AS (
            SELECT 
                to_char(COALESCE(so.order_date, so.deadline, so.created_at::date), 'YYYY-MM') as m,
                ROUND(SUM(COALESCE((elem->>'quantity')::numeric, 0))) as d_rolls
            FROM sales_orders so,
            LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(so.items) = 'array' THEN so.items ELSE '[]'::jsonb END) elem
            WHERE so.status = 'Delivered'
              AND COALESCE(so.order_date, so.deadline, so.created_at::date) >= start_date
              AND COALESCE(so.order_date, so.deadline, so.created_at::date) <= end_date
              AND (
                  UPPER(COALESCE(elem->>'sku', '')) LIKE 'BW-%' 
                  OR UPPER(COALESCE(elem->>'sku', '')) LIKE 'SL-%'
                  OR UPPER(COALESCE(elem->>'sku', '')) LIKE 'DL-%'
                  OR UPPER(COALESCE(elem->>'product', elem->>'name', '')) LIKE '%MERAH%'
                  OR UPPER(COALESCE(elem->>'product', elem->>'name', '')) LIKE '%OREN%'
                  OR UPPER(COALESCE(elem->>'product', elem->>'name', '')) LIKE '%HITAM%'
                  OR UPPER(COALESCE(elem->>'product', elem->>'name', '')) LIKE '%BUBBLE%'
              )
            GROUP BY 1
        ),
        deliv AS (
            SELECT 
                to_char(COALESCE(order_date, deadline, created_at::date), 'YYYY-MM') as m,
                COUNT(*) as d_orders,
                COUNT(DISTINCT COALESCE(trip_id::text, order_number, id::text)) as d_trips,
                SUM(GREATEST(1, COALESCE(trip_drop_count, 1))) as d_drops
            FROM sales_orders
            WHERE status = 'Delivered'
              AND COALESCE(order_date, deadline, created_at::date) >= start_date
              AND COALESCE(order_date, deadline, created_at::date) <= end_date
            GROUP BY 1
        ),
        all_months AS (
            SELECT m FROM prod
            UNION
            SELECT m FROM deliv
        )
        SELECT 
            am.m as month_str,
            COALESCE(p.p_rolls, 0) as production_rolls,
            COALESCE(p.s_kg, 0) as scrap_kg,
            COALESCE(p.rec_kg, 0) as recycle_kg,
            COALESCE(dr.d_rolls, 0) as delivered_rolls,
            COALESCE(d.d_orders, 0) as delivered_orders,
            COALESCE(d.d_trips, 0) as delivered_trips,
            COALESCE(d.d_drops, 0) as delivered_drops,
            COALESCE(p.tp_rolls, 0) as taiping_rolls,
            COALESCE(p.nl_rolls, 0) as nilai_rolls,
            COALESCE(p.kl_rolls, 0) as kelantan_rolls,
            COALESCE(p.jh_rolls, 0) as johor_rolls
        FROM all_months am
        LEFT JOIN prod p ON p.m = am.m
        LEFT JOIN deliv_rolls dr ON dr.m = am.m
        LEFT JOIN deliv d ON d.m = am.m
        ORDER BY am.m ASC;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION get_monthly_executive_trends(date, date) TO anon, authenticated, service_role;
    `;

    await client.query(sql);
    console.log('✅ Updated get_monthly_executive_trends with statement_timeout = 30s!');
    await client.end();
}

main().catch(console.error);
