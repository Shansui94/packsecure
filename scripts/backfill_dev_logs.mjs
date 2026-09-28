#!/usr/bin/env node
/**
 * backfill_dev_logs.mjs
 * Sequentially backfills missing daily dev logs.
 */

import { generateDevLogForDate } from './generate-dev-log.mjs';

const DATES_TO_BACKFILL = [
    '2026-09-18',
    '2026-09-20',
    '2026-09-21',
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-09-28',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log(`🚀 Starting Dev Log backfill for ${DATES_TO_BACKFILL.length} dates...`);

    const results = [];
    for (const date of DATES_TO_BACKFILL) {
        try {
            const res = await generateDevLogForDate(date);
            results.push({ date, success: true, commits: res.commitsCount });
        } catch (err) {
            console.error(`❌ Failed backfill for ${date}:`, err.message);
            results.push({ date, success: false, error: err.message });
        }
        await sleep(1500); // 1.5s delay between dates
    }

    console.log('\n================ BACKFILL SUMMARY ================');
    results.forEach(r => {
        if (r.success) {
            console.log(`✅ ${r.date}: ${r.commits} commits processed`);
        } else {
            console.log(`❌ ${r.date}: FAILED (${r.error})`);
        }
    });
    console.log('==================================================');
}

main().catch(err => {
    console.error('Fatal in backfill runner:', err);
    process.exit(1);
});
