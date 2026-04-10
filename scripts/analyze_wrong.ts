import * as fs from 'fs';

const logs = JSON.parse(fs.readFileSync('wrong_logs.json', 'utf8'));

const agg: Record<string, number> = {};

logs.forEach((l: any) => {
    // Force UTC+8 manually to match exactly what the user sees in Malaysia
    const d = new Date(l.created_at);
    d.setHours(d.getHours() + 8);
    const dateStr = d.toISOString().split('T')[0]; // "2026-04-02"
    
    const key = `${dateStr} | ${l.sku}`;
    agg[key] = (agg[key] || 0) + l.output_qty;
});

fs.writeFileSync('wrong_logs_analysis.json', JSON.stringify(agg, null, 2));
console.log("Analysis written to wrong_logs_analysis.json");
