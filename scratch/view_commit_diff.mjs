import { execSync } from 'child_process';

try {
    const diff = execSync('git diff da6f4906537f30baeb82a239f45255c79ce0bce9^ da6f4906537f30baeb82a239f45255c79ce0bce9 -- src/pages/ProductionControl.tsx').toString();
    const lines = diff.split('\n');
    
    console.log("Showing diff lines for syncAttendance:");
    let print = false;
    let count = 0;
    
    for (const line of lines) {
        if (line.includes('syncAttendance') || line.includes('CHECK AND HANDLE TAKEOVER')) {
            print = true;
            count = 0;
        }
        
        if (print) {
            console.log(line);
            count++;
            if (count > 50) {
                print = false;
            }
        }
    }
} catch (e) {
    console.error(e);
}
