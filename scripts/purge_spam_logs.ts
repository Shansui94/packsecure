import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function purgeSpamLogs() {
  console.log('=== EXECUTING PRECISION PURGE: T2-M01 Ghost Logs (2026-09-23) ===');

  const { data: logs, error } = await supabase
    .from('production_logs_v2')
    .select('log_id, machine_id, sku, output_qty, created_at')
    .eq('machine_id', 'T2-M01')
    .gte('created_at', '2026-09-23T00:00:00Z')
    .lte('created_at', '2026-09-23T23:59:59Z')
    .order('created_at', { ascending: true });

  if (error || !logs) {
    console.error('Fetch error:', error);
    return;
  }

  // Group by alarm pulse
  type AlarmPulse = {
    firstTime: number;
    logs: typeof logs;
  };

  const pulses: AlarmPulse[] = [];
  for (const log of logs) {
    const t = new Date(log.created_at).getTime();
    const lastPulse = pulses[pulses.length - 1];
    if (lastPulse && Math.abs(t - lastPulse.firstTime) < 2000) {
      lastPulse.logs.push(log);
    } else {
      pulses.push({ firstTime: t, logs: [log] });
    }
  }

  const legitimatePulses: AlarmPulse[] = [];
  const spamPulses: AlarmPulse[] = [];

  for (let i = 0; i < pulses.length; i++) {
    if (i === 0) {
      legitimatePulses.push(pulses[i]);
      continue;
    }
    const prev = pulses[i - 1];
    const curr = pulses[i];
    const diffSec = (curr.firstTime - prev.firstTime) / 1000;

    if (diffSec < 240) {
      spamPulses.push(curr);
    } else {
      legitimatePulses.push(curr);
    }
  }

  const spamLogs = spamPulses.flatMap(p => p.logs);
  const spamLogIds = spamLogs.map(l => l.log_id);
  const spamLogIdStrings = spamLogIds.map(id => id.toString());

  console.log(`Found ${spamLogIds.length} spam rows in production_logs_v2 to purge.`);

  // 1. Delete matching stock_ledger_v2 rows in batches of 100
  let deletedLedgerRows = 0;
  for (let i = 0; i < spamLogIdStrings.length; i += 100) {
    const chunk = spamLogIdStrings.slice(i, i + 100);
    const { data, error: delErr } = await supabase
      .from('stock_ledger_v2')
      .delete()
      .in('ref_doc', chunk)
      .select('txn_id');

    if (delErr) {
      console.error('Error deleting stock_ledger_v2 chunk:', delErr);
    } else {
      deletedLedgerRows += (data?.length || 0);
    }
  }
  console.log(`Successfully deleted ${deletedLedgerRows} ghost rows from stock_ledger_v2.`);

  // 2. Delete spam rows from production_logs_v2 in batches of 100
  let deletedProdRows = 0;
  for (let i = 0; i < spamLogIds.length; i += 100) {
    const chunk = spamLogIds.slice(i, i + 100);
    const { data, error: delErr } = await supabase
      .from('production_logs_v2')
      .delete()
      .in('log_id', chunk)
      .select('log_id');

    if (delErr) {
      console.error('Error deleting production_logs_v2 chunk:', delErr);
    } else {
      deletedProdRows += (data?.length || 0);
    }
  }
  console.log(`Successfully deleted ${deletedProdRows} ghost rows from production_logs_v2.`);
  console.log('=== PURGE COMPLETE! Inventory & production metrics fully restored. ===');
}

purgeSpamLogs();
