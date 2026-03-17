
import fs from "fs";
const path = "./src/pages/MachineSchedule.tsx";
let content = fs.readFileSync(path, "utf8");

const startToken = "{/* Main Schedule Board */}";
const endToken = "{/* Assignment Modal */}";

const startIndex = content.indexOf(startToken);
const endIndex = content.indexOf(endToken);

if (startIndex === -1 || endIndex === -1) {
    console.error("Tokens not found!");
    process.exit(1);
}

const newBoard = `{/* Main Schedule Board */}
                <div className="bg-[#0f0f13] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-blue-500 border-solid animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading Timeline...</span>
                        </div>
                    ) : (
                        <div className="min-w-[900px]">
                            {/* Gantt Header */}
                            <div className="flex bg-black/40 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 sticky top-0 z-20">
                                <div className="w-56 shrink-0 p-4 border-r border-white/5 flex items-center justify-between">
                                    <span>Machine Unit</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-sm bg-blue-500/30 border border-blue-500/50" title="Planned" />
                                        <div className="w-3 h-1.5 rounded-full bg-green-500" title="Actual" />
                                    </div>
                                </div>
                                <div className="flex-1 relative h-12 flex items-end">
                                    {/* 24-hour markers */}
                                    {Array.from({ length: 25 }).map((_, i) => (
                                        <div key={i} className="absolute bottom-0 border-l border-white/10 h-3 flex items-end" style={{ left: \`\${(i / 24) * 100}%\` }}>
                                            <span className="text-[9px] -translate-x-1/2 -translate-y-4 tabular-nums absolute">
                                                {i.toString().padStart(2, "0")}:00
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Gantt Rows */}
                            <div className="divide-y divide-white/5">
                                {machines.map(machine => {
                                    const planned = getPlannedForMachine(machine);
                                    const actuals = getActualForMachine(machine);
                                    const rowMinHeight = Math.max(80, (actuals.length > 0 ? actuals.length * 30 + 20 : 80));
                                    
                                    return (
                                        <div key={machine} className="flex hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-blue-500 group relative">
                                            {/* Y-Axis Label */}
                                            <div className="w-56 shrink-0 p-4 border-r border-white/5 flex flex-col justify-center bg-[#0f0f13] z-10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-all">
                                                            <Wrench size={18} className="text-gray-400 group-hover:text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-lg text-white tracking-tight leading-none mb-1">{machine}</div>
                                                            <div className="text-[9px] text-gray-500 font-mono uppercase">Production Unit</div>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleOpenAssignModal(machine)} className="w-7 h-7 rounded bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" title="Assign Operator">
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Timeline Area */}
                                            <div className="flex-1 relative py-2" style={{ minHeight: \`\${rowMinHeight}px\` }}>
                                                {/* Vertical Grid Lines */}
                                                {Array.from({ length: 24 }).map((_, i) => (
                                                    <div key={i} className="absolute top-0 bottom-0 border-l border-white/[0.03] pointer-events-none" style={{ left: \`\${(i / 24) * 100}%\` }} />
                                                ))}

                                                {/* 1. Planned Bars (Background layer) */}
                                                {planned.map((p, idx) => {
                                                    let left = 0; let width = 0;
                                                    if (p.shift_type === "Morning") { left = (8/24)*100; width = (12/24)*100; }
                                                    else if (p.shift_type === "Night") { left = (20/24)*100; width = (4/24)*100; }
                                                    else { left = 0; width = 100; }

                                                    return (
                                                        <div 
                                                            key={p.id}
                                                            className="absolute rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex flex-col justify-center px-3 overflow-hidden group/plan"
                                                            style={{ left: \`\${left}%\`, width: \`\${width}%\`, top: "8px", bottom: "8px" }}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-[11px] font-bold text-blue-200 truncate">{p.operator_name}</span>
                                                                <button onClick={() => handleDeleteSchedule(p.id)} className="w-5 h-5 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400 flex items-center justify-center opacity-0 group-hover/plan:opacity-100 transition-opacity bg-black/20" title="Remove Assignment">
                                                                    <div className="w-2 h-0.5 bg-current rotate-45 absolute" />
                                                                    <div className="w-2 h-0.5 bg-current -rotate-45 absolute" />
                                                                </button>
                                                            </div>
                                                            <span className="text-[9px] text-blue-400/50 uppercase tracking-widest font-mono truncate">{p.shift_type}</span>
                                                        </div>
                                                    );
                                                })}

                                                {/* 2. Actual Clock-in Bars (Foreground layer) */}
                                                {actuals.map((a, idx) => {
                                                    const inDate = new Date(a.clock_in);
                                                    const startHour = inDate.getHours() + inDate.getMinutes() / 60;
                                                    
                                                    let endHour = 24;
                                                    let isPulsing = false;

                                                    if (a.clock_out) {
                                                        const outDate = new Date(a.clock_out);
                                                        endHour = outDate.getHours() + outDate.getMinutes() / 60;
                                                    } else {
                                                        const now = new Date();
                                                        if (selectedDate === now.toISOString().split("T")[0]) {
                                                            endHour = now.getHours() + now.getMinutes() / 60;
                                                            isPulsing = true;
                                                        } else {
                                                            endHour = 24;
                                                        }
                                                    }

                                                    if (endHour <= startHour) endHour = startHour + 0.1;

                                                    const left = (startHour / 24) * 100;
                                                    const width = ((endHour - startHour) / 24) * 100;

                                                    const isScheduled = planned.some(p => p.operator_id === a.employee_id);
                                                    const colorClass = isScheduled 
                                                        ? "bg-gradient-to-r from-green-500 to-green-400 border border-green-500/50 shadow-[0_2px_10px_rgba(34,197,94,0.4)] text-green-950" 
                                                        : "bg-gradient-to-r from-orange-500 to-orange-400 border border-orange-500/50 shadow-[0_2px_10px_rgba(249,115,22,0.4)] text-orange-950";
                                                    
                                                    // Offset each actual bar vertically so they do not overlap
                                                    const topOffset = idx * 28 + 16;

                                                    return (
                                                        <div 
                                                            key={a.id}
                                                            className={\`absolute h-6 rounded-full overflow-hidden flex items-center px-2 z-10 transition-transform hover:scale-[1.02] cursor-default opacity-90 hover:opacity-100 \${colorClass}\`}
                                                            style={{ left: \`\${left}%\`, width: \`\${width}%\`, top: \`\${topOffset}px\` }}
                                                            title={\`\${a.employee_name} | IN: \${inDate.toLocaleTimeString()} | OUT: \${a.clock_out ? new Date(a.clock_out).toLocaleTimeString() : "Active"}\`}
                                                        >
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                {isPulsing && <div className="w-1.5 h-1.5 rounded-full bg-black/60 animate-pulse shrink-0" />}
                                                                <span className="text-[10px] font-black truncate">{a.employee_name}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            `;

const result = content.substring(0, startIndex) + newBoard + content.substring(endIndex);
fs.writeFileSync(path, result);
console.log("Timeline view injected successfully!");

