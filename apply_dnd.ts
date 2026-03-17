import fs from "fs";
const path = "./src/pages/MachineSchedule.tsx";
let content = fs.readFileSync(path, "utf8");

// 1. Add required imports & types
content = content.replace(
    /import \{ Calendar as CalendarIcon, Wrench, Plus \} from .lucide-react.;/g,
    `import { Calendar as CalendarIcon, Wrench, Plus, GripVertical, Users } from "lucide-react";`
);

content = content.replace(
    /shift_type: string;/g,
    `shift_type: "Morning" | "Evening" | "Night";`
);

// 2. Add Drag and Drop state variables
content = content.replace(
    /const \[targetMachine, setTargetMachine\] = useState<string \| null>\(null\);/,
    `const [targetMachine, setTargetMachine] = useState<string | null>(null);
    const [draggedOperator, setDraggedOperator] = useState<Operator | null>(null);
    const [dragOverMachine, setDragOverMachine] = useState<string | null>(null);
    const [dragOverShift, setDragOverShift] = useState<"Morning" | "Evening" | "Night" | null>(null);`
);

// 3. Update shift selector state type
content = content.replace(
    /const \[selectedShift, setSelectedShift\] = useState<'Morning' \| 'Night' \| 'All'>\('All'\);/g,
    `const [selectedShift, setSelectedShift] = useState<"Morning" | "Evening" | "Night" | "All">("All");`
);
content = content.replace(
    /<option value="Night">Night<\/option>/g,
    `<option value="Evening">Evening</option>\n<option value="Night">Night</option>`
);

// 4. Update the quick assign modal default state
content = content.replace(
    /const \[targetShift, setTargetShift\] = useState<'Morning' \| 'Night'>\('Morning'\);/g,
    `const [targetShift, setTargetShift] = useState<"Morning" | "Evening" | "Night">("Morning");`
);
content = content.replace(
    /<option value="Night">Night Shift<\/option>/g,
    `<option value="Evening">Evening Shift</option>\n<option value="Night">Night Shift</option>`
);

// 5. Add Drag Handlers to the component before the return
const dragHandlers = `
    const handleDragStart = (e: React.DragEvent, op: Operator) => {
        setDraggedOperator(op);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e: React.DragEvent, machineId: string, shift: "Morning" | "Evening" | "Night") => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (dragOverMachine !== machineId || dragOverShift !== shift) {
            setDragOverMachine(machineId);
            setDragOverShift(shift);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverMachine(null);
        setDragOverShift(null);
    };

    const handleDrop = async (e: React.DragEvent, machineId: string, shift: "Morning" | "Evening" | "Night") => {
        e.preventDefault();
        setDragOverMachine(null);
        setDragOverShift(null);
        
        if (!draggedOperator) return;

        setIsSubmitting(true);
        try {
            const newSchedule = {
                machine_id: machineId,
                operator_id: draggedOperator.employee_id,
                operator_name: draggedOperator.display_name,
                shift_date: selectedDate,
                shift_type: shift
            };

            const { data, error } = await supabase
                .from('machine_schedules')
                .insert([newSchedule])
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setPlannedSchedules(prev => [...prev, data]);
            }
        } catch (err: any) {
            alert('Failed to assign operator: ' + err.message);
        } finally {
            setIsSubmitting(false);
            setDraggedOperator(null);
        }
    };
`;
content = content.replace(
    /return \(/,
    `${dragHandlers}\n    return (`
);

// 6. Restructure layout for Sidebar + Main Gantt
content = content.replace(
    /<div className="max-w-7xl mx-auto">/,
    `<div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-6">
        {/* Sidebar: Available Operators */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-4">
            <div className="bg-[#0f0f13] border border-white/5 auto-rows-max rounded-3xl p-4 shadow-xl flex flex-col gap-3 sticky top-6 max-h-[calc(100vh-120px)] overflow-hidden">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <Users size={18} />
                    <h2 className="font-black text-white">Operators</h2>
                </div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed mb-1">
                    Drag names to timeline to assign shifts.
                </div>
                <div className="overflow-y-auto pr-2 flex flex-col gap-2 relative better-scrollbar pb-8">
                    {operators.map(op => {
                        const isAssigned = plannedSchedules.some(p => p.operator_id === op.employee_id);
                        return (
                            <div 
                                key={op.employee_id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, op)}
                                onDragEnd={() => setDraggedOperator(null)}
                                className={\`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:-translate-y-0.5 \${isAssigned ? "bg-white/5 border-white/10 opacity-60" : "bg-blue-900/20 border-blue-500/30 hover:bg-blue-800/30 hover:shadow-[0_4px_12px_rgba(59,130,246,0.2)]"}\`}
                            >
                                <GripVertical size={14} className="text-gray-500" />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-gray-200 truncate">{op.display_name}</span>
                                    <span className="text-[9px] text-gray-500 font-mono uppercase truncate">{op.position}</span>
                                </div>
                                {isAssigned && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" title="Assigned Today" />}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">`
);

content = content.replace(
    /\{isAssignModalOpen/,
    `        </div>\n    </div>\n    {isAssignModalOpen`
);

// 7. Update Timeline Layout
const timelineRegex = /\{\/\* Timeline Area \*\/\}[\s\S]*?(?=\{\/\* 2\. Actual Clock-in Bars)/;
const newTimelineCode = `{/* Timeline Area - Includes Drop Zones & Planned Bars */}
<div className="flex-1 relative py-2 flex" style={{ minHeight: \`\${rowMinHeight}px\` }}>
    {/* Drop Zones for 3 Shifts */}
    {(["Morning", "Evening", "Night"] as const).map((shift, sIdx) => {
        const isActiveDrop = dragOverMachine === machine && dragOverShift === shift;
        return (
            <div 
                key={shift}
                onDragOver={(e) => handleDragOver(e, machine, shift)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, machine, shift)}
                className={\`flex-1 h-full border-r border-white/5 relative transition-colors \${isActiveDrop ? "bg-blue-500/20" : "hover:bg-white/[0.03]"}\`}
            >
                {/* 8-hour sub-grid lines inside the shift block */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-white/[0.03] pointer-events-none" style={{ left: \`\${(i / 8) * 100}%\` }} />
                ))}
            </div>
        );
    })}

    {/* 1. Planned Bars (Background layer) */}
    {planned.map((p) => {
        let left = 0; let width = (8/24)*100; // All shifts are 8 hours now
        if (p.shift_type === "Morning") { left = (8/24)*100; }
        else if (p.shift_type === "Evening") { left = (16/24)*100; }
        else if (p.shift_type === "Night") { left = 0; } // 00:00 to 08:00
        else { left = 0; width = 100; }

        return (
            <div 
                key={p.id}
                className="absolute rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex flex-col justify-center px-3 overflow-hidden group/plan z-20 shadow-lg backdrop-blur-sm"
                style={{ left: \`\${left}%\`, width: \`\${width}%\`, top: "8px", bottom: "8px" }}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-blue-200 truncate">{p.operator_name}</span>
                    <button onClick={() => handleDeleteSchedule(p.id)} className="w-5 h-5 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400 flex items-center justify-center opacity-0 group-hover/plan:opacity-100 transition-opacity bg-black/40" title="Remove Assignment">
                        <div className="w-2 h-0.5 bg-current rotate-45 absolute" />
                        <div className="w-2 h-0.5 bg-current -rotate-45 absolute" />
                    </button>
                </div>
                <span className="text-[9px] text-blue-400/50 uppercase tracking-widest font-mono truncate">{p.shift_type}</span>
            </div>
        );
    })}
`;
content = content.replace(timelineRegex, newTimelineCode);

fs.writeFileSync(path, content);
console.log("Timeline DND modified");
