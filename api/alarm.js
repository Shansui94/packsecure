
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // STUB DEBUG MODE
    try {
        console.log("Stub Alarm Handler Reached");
        res.status(200).json({
            status: 'stub_success',
            message: 'Logic temporarily passed',
            debug: {
                node: process.version,
                has_fetch: typeof fetch !== 'undefined',
                body_received: req.body
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
