import dns from 'dns';
import pg from 'pg';
const { Client } = pg;

const host = 'db.kdahubyhwndgyloaljak.supabase.co';

dns.resolve6(host, async (err, addresses) => {
    console.log("IPv6 addresses resolved:", { err, addresses });
    if (addresses && addresses.length > 0) {
        console.log("Trying to connect to resolved IPv6:", addresses[0]);
        const config = {
            user: 'postgres',
            password: '$QNQ4rAW*#%294z',
            host: addresses[0],
            port: 5432,
            database: 'postgres',
            ssl: { rejectUnauthorized: false }
        };
        const client = new Client(config);
        try {
            await client.connect();
            console.log("✅ IPv6 Connection Success!");
            await client.end();
        } catch (connErr) {
            console.error("❌ IPv6 Connection Failed:", connErr.message);
        }
    }
});
