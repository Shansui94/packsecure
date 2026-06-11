import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://kdahubyhwndgyloaljak.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

(async () => {
  // Get recent operator attendance with machine_id
  const { data } = await sb
    .from('operator_attendance')
    .select('operator_id, machine_id, date, clock_in, clock_out')
    .not('machine_id', 'is', null)
    .order('date', { ascending: false })
    .limit(10);
  
  console.log('Recent operator_attendance with machine_id:');
  data?.forEach(r => console.log(`  ${r.date} | operator: ${r.operator_id} | machine: ${r.machine_id} | ${r.clock_in} → ${r.clock_out}`));

  // Also get operator names
  if (data && data.length > 0) {
    const opIds = [...new Set(data.map(d => d.operator_id))];
    const { data: ops } = await sb
      .from('sys_users_v2')
      .select('employee_id, name')
      .in('employee_id', opIds);
    console.log('\nOperator names:');
    ops?.forEach(o => console.log(`  ${o.employee_id} = ${o.name}`));
  }
})();
