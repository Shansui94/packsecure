import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFix() {
  const CORRECT_SKU = 'BW-SL-BLK-100Mx100CMx1ROLL-GRN';
  const TARGET_MACHINE = 'T1.3-M02';

  const wrongs = [
    { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', date: '2026-04-03', expectedQty: 37 },
    { sku: 'BW-SL-CLR-100Mx25CMx4ROLL-GRN', date: '2026-04-02', expectedQty: 31 }
  ];

  for (const w of wrongs) {
      console.log(`\n--- Fixing ${w.sku} on ${w.date} for ${TARGET_MACHINE} ---`);
      
      // 1. Find the production logs
      const { data: pLogs } = await supabase
        .from('production_logs_v2')
        .select('*')
        .eq('sku', w.sku)
        .eq('machine_id', TARGET_MACHINE) // RESTRICT TO TARGET
        .gte('created_at', w.date + "T00:00:00.000Z")
        .lt('created_at', w.date + "T23:59:59.999Z");

      const totalFound = pLogs?.reduce((s, x) => s + x.output_qty, 0) || 0;
      console.log(`Found ${pLogs?.length || 0} production_logs total qty: ${totalFound} (Expected: ${w.expectedQty})`);

      if (totalFound === w.expectedQty) {
          console.log(`Matched expected quantity! UPDATE to ${CORRECT_SKU}...`);
          
          if (pLogs && pLogs.length > 0) {
              const { error: pErr } = await supabase
                .from('production_logs_v2')
                .update({ sku: CORRECT_SKU, updated_at: new Date().toISOString() })
                .in('log_id', pLogs.map(p => p.log_id));
              if (pErr) console.error("Error updating production_logs", pErr);
              else console.log(`✓ Updated ${pLogs.length} production logs.`);
          }
      } else {
          console.log("WAIT! Qty doesn't exactly match... Check pLogs manually.");
      }
      
      // Stock Ledger Correction
      // We can't rely on machine_id in stock_ledger_v2 since it's missing or mixed
      // But we can just find exactly the same totalQty of records for that SKU on that date matching event_type='Production'
      const { data: lLogs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', w.sku)
        .eq('event_type', 'Production')
        .gte('timestamp', w.date + "T00:00:00.000Z")
        .lt('timestamp', w.date + "T23:59:59.999Z");
        
      const totalLedgerFound = lLogs?.reduce((s, x) => s + x.change_qty, 0) || 0;
      // Also to be extremely safe, we only change if the aggregate stock ledger matches exactly
      if (totalLedgerFound === w.expectedQty) {
          console.log(`Matched ledger quantity! UPDATE ledger to ${CORRECT_SKU}...`);
          if (lLogs && lLogs.length > 0) {
              const { error: lErr } = await supabase
                .from('stock_ledger_v2')
                .update({ sku: CORRECT_SKU, notes: 'Corrected SKU by admin request' })
                .in('txn_id', lLogs.map(l => l.txn_id));
              if (lErr) console.error("Error updating stock_ledger", lErr);
              else console.log(`✓ Updated ${lLogs.length} ledger logs.`);
          }
      } else {
          // Fallback: If it doesn't strictly match expectedQty, maybe other machines also produced the wrong sku.
          // In this case, we MUST only update exactly 'w.expectedQty' worth of ledger rows to match.
          console.log(`Ledger total ${totalLedgerFound} != expected ${w.expectedQty}.`);
          console.log(`Attempting precise ledger deduction...`);
          
          let selectedLedgerIds = [];
          let accumulated = 0;
          if (lLogs) {
              for (const l of lLogs) {
                  if (accumulated + l.change_qty <= w.expectedQty) {
                      accumulated += l.change_qty;
                      selectedLedgerIds.push(l.txn_id);
                  }
              }
              if (accumulated === w.expectedQty) {
                  console.log(`Found an exact combination of ledger rows totaling ${w.expectedQty}! Updating...`);
                  const { error: lErr } = await supabase
                    .from('stock_ledger_v2')
                    .update({ sku: CORRECT_SKU, notes: `Corrected SKU for ${TARGET_MACHINE}` })
                    .in('txn_id', selectedLedgerIds);
                  if (lErr) console.error("Error updating selective stock_ledger", lErr);
                  else console.log(`✓ Selected and Updated ${selectedLedgerIds.length} ledger logs matching exact expected qty.`);
              } else {
                  console.error("COULD NOT FIND EXACT LEDGER COMBINATION! Leaving stock_ledger_v2 untouched.");
              }
          }
      }
  }
}

checkAndFix();
