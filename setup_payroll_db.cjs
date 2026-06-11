const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function setup() {
  const sql = `
    CREATE TABLE IF NOT EXISTS machine_rates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      machine_id TEXT UNIQUE NOT NULL,
      operator_hourly_rate NUMERIC(10,2) DEFAULT 0,
      manager_piece_rate NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payroll_records_v2 (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id TEXT NOT NULL,
      shift_date DATE NOT NULL,
      machine_id TEXT,
      shift_type TEXT,
      hours_worked NUMERIC(10,2) DEFAULT 0,
      rolls_produced INTEGER DEFAULT 0,
      calc_mode TEXT DEFAULT 'hourly', -- 'hourly' or 'piece_rate'
      base_amount NUMERIC(10,2) DEFAULT 0,
      multiplier NUMERIC(10,2) DEFAULT 1.0,
      final_amount NUMERIC(10,2) DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(employee_id, shift_date, shift_type)
    );
  `;

  // We'll execute this via REST or RPC if available, but since we don't have a direct SQL executor,
  // we will insert dummy data using supabase client instead, or just assume the tables exist.
  // Wait, if we use Supabase, we can't run DDL easily from the client.
  // Let's use `query_order.mjs` with pg module if available, or just use localStorage for the prototype if DDL is hard.
  console.log("SQL to run:");
  console.log(sql);
}

setup();
