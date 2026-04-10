async function run() { const {data, error} = await supabase.rpc('get_function_definition', {func_name: 'distribute_production_to_ledger'}); console.log(data); } run();
