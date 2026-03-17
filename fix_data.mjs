
import fs from "fs";
const path = "./src/pages/MachineSchedule.tsx";
let content = fs.readFileSync(path, "utf8");

// 1. Fix the machines state initialization to keep the full objects, not just short strings
// Find: const [machines] = useState<string[]>( Array.from(new Set(MACHINES.map(m => m.id.split(`-`)[0]))) );
content = content.replace(
    /const \[machines\] = useState<string\[\]>\([\s\S]*?\);/,
    `const [machines] = useState<any[]>(MACHINES);`
);

// 2. Fix the Gantt Rows map and function calls
// Find: {machines.map(machine => { 
// Replace with: {machines.map(machineItem => { const machine = machineItem.id; const machineName = machineItem.name;
content = content.replace(
    /\{machines\.map\(machine => \{/g,
    `{machines.map(machineItem => { const machine = machineItem.id; const machineName = machineItem.name;`
);

// 3. Fix the display name from {machine} to {machineName}
// Find: <div className="font-black text-lg text-white tracking-tight leading-none mb-1">{machine}</div>
content = content.replace(
    /<div className="font-black text-lg text-white tracking-tight leading-none mb-1">\{machine\}<\/div>/g,
    `<div className="font-black text-lg text-white tracking-tight leading-none mb-1">{machineName}</div>`
);

// 4. Update Target Machine assignment popup 
content = content.replace(
    /<div className="bg-white\/5 border border-white\/10 rounded-xl px-4 py-3 text-white font-bold">\{targetMachine\}<\/div>/g,
    `<div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold">{machines.find(m => m.id === targetMachine)?.name || targetMachine}</div>`
);

fs.writeFileSync(path, content);
console.log("Fixed machine logic");

