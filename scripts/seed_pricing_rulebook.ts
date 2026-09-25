import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const mdPath = path.resolve('docs/sops/Driver_Pricing_Rules.md');
  const contentMd = fs.readFileSync(mdPath, 'utf-8');

  console.log('Seeding Driver Pricing Rulebook v1.0.0 into Supabase...');

  // Check if pricing_rulebooks table is available
  const { data: existing, error: checkError } = await supabase
    .from('pricing_rulebooks')
    .select('id, version, is_active')
    .eq('rule_type', 'DRIVER_DELIVERY')
    .eq('version', 'v1.0.0')
    .maybeSingle();

  if (checkError) {
    console.warn('pricing_rulebooks table may not exist yet in public schema:', checkError.message);
    console.log('Please execute the migration script scripts/migrations/20260925_create_driver_pricing_closed_loop.sql in Supabase SQL Editor.');
    return;
  }

  if (existing) {
    console.log(`Rulebook v1.0.0 already exists (ID: ${existing.id}, active: ${existing.is_active}). Updating content...`);
    const { error: updErr } = await supabase
      .from('pricing_rulebooks')
      .update({
        content_md: contentMd,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updErr) console.error('Update failed:', updErr.message);
    else console.log('Successfully updated rulebook v1.0.0.');
  } else {
    // Deactivate previous active rules
    await supabase
      .from('pricing_rulebooks')
      .update({ is_active: false })
      .eq('rule_type', 'DRIVER_DELIVERY');

    const { data: inserted, error: insErr } = await supabase
      .from('pricing_rulebooks')
      .insert({
        rule_type: 'DRIVER_DELIVERY',
        version: 'v1.0.0',
        title: '司机运费与送货价格真理库',
        content_md: contentMd,
        is_active: true,
        changelog: '初始基准版本：同步工厂既有各州阶梯与落点补贴',
        created_by: 'System Seed'
      })
      .select()
      .maybeSingle();

    if (insErr) {
      console.error('Insert failed:', insErr.message);
    } else {
      console.log('Successfully inserted active rulebook v1.0.0 (ID:', inserted?.id, ')');
    }
  }
}

seed().catch(console.error);
