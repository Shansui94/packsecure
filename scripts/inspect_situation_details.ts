import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const mytStartOfToday = '2026-09-25T16:00:00.000Z';

  // 1. Check any whatsapp related logs or photos
  const { data: wpPhotos } = await supabase
    .from('work_photos')
    .select('id, employee_name, category, user_note, ai_description, created_at')
    .gte('created_at', mytStartOfToday)
    .or('user_note.ilike.%whatsapp%,ai_description.ilike.%whatsapp%');

  console.log('=== 今日 WhatsApp 相关提交记录 (work_photos) ===');
  console.log(`数量: ${wpPhotos?.length || 0}`);
  wpPhotos?.forEach(p => console.log(p));

  // 2. Check any driver messages or communications
  const { data: driverMsgs } = await supabase
    .from('work_photos')
    .select('employee_name, category, user_note, ai_description, created_at')
    .gte('created_at', mytStartOfToday)
    .in('category', ['driver_feedback', 'EXCEPTION', 'whatsapp', 'pod', 'POD']);

  console.log('\n=== 今日司机上报/现场异常反馈 (共 ' + (driverMsgs?.length || 0) + ' 条) ===');
  driverMsgs?.slice(0, 5).forEach(m => console.log(m));

  // 3. Check machines running today (which machines have QC / inspection logs today)
  const { data: machineLogs } = await supabase
    .from('work_photos')
    .select('machine_id, category')
    .gte('created_at', mytStartOfToday)
    .not('machine_id', 'is', null);

  const activeMachines = new Set(machineLogs?.map(m => m.machine_id));
  console.log('\n=== 今日车间有打卡/质检/巡检动作的机台 ===');
  console.log(Array.from(activeMachines).sort());
}

main().catch(console.error);
