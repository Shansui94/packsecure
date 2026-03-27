import { execSync } from 'child_process';
const log = execSync('git log -n 5 --oneline').toString();
console.log(log);
