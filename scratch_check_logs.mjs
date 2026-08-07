import pg from 'pg';

async function checkOrderLogs() {
    const client = new pg.Client({
        host: "aws-1-ap-south-1.pooler.supabase.com",
        port: 6543,
        user: "postgres.kdahubyhwndgyloaljak",
        password: "$QNQ4rAW*#%294z",
        database: "postgres"
    });

    try {
        await client.connect();
        
        // 1. Fetch current details of order DO-WAN-260618-001
        const orderNumber = 'DO-WAN-260618-001';
        console.log(`Checking current status of ${orderNumber}...`);
        const resOrder = await client.query(
            "SELECT id, status, notes, pod_photo_url, pod_timestamp, driver_id FROM sales_orders WHERE order_number = $1",
            [orderNumber]
        );
        console.log("Order info:", JSON.stringify(resOrder.rows, null, 2));

        if (resOrder.rows.length === 0) {
            console.log("Order not found!");
            return;
        }

        // 2. Query all triggers in public schema
        console.log(`\nQuerying all triggers in public schema...`);
        const resTriggers = await client.query(
            `SELECT 
                event_object_table as table_name,
                trigger_name, 
                event_manipulation as event, 
                action_statement as action,
                action_timing as timing
             FROM information_schema.triggers 
             WHERE trigger_schema = 'public'
             ORDER BY table_name, trigger_name`
        );
        console.log("All Triggers:");
        console.table(resTriggers.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

checkOrderLogs();
