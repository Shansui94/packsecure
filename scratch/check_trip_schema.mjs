import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 查询 information_schema.tables 获取所有 public 表名
    const { data, error } = await supabase
        .rpc('get_tables'); // 如果没有 get_tables RPC，我们直接发一个 query 或者使用 get_schema_meta。
    
    if (error) {
        // 如果没有 rpc，我们直接用 SQL 来查询
        // 或者我们可以查看 supabase 迁移文件
        console.error("RPC Error:", error);
    } else {
        console.log("Tables:", data);
    }

    // 我们可以直接执行 sql 来查表名，但如果没有特殊的 SQL 执行器，我们可以试着查询 supabase/migrations 目录下的文件
}

run();
