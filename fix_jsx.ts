
import fs from "fs";
const path = "./src/pages/MachineSchedule.tsx";
let content = fs.readFileSync(path, "utf8");

// I noticed the original div structure might have an extra unclosed div because of replacing the inner section
// Let us completely overwrite the file with the properly formatted React component.

const properlyFormattedComponent = `import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { Calendar as CalendarIcon, Wrench, Plus, GripVertical, Users } from "lucide-react";
import { MACHINES } from "../data/factoryData";

interface Operator {
    employee_id: string;
    display_name: string;
    position: string;
}

interface PlannedSchedule {
    id: string;
    machine_id: string;
    operator_id: string;
    operator_name: string;
    shift_date: string;
    shift_type: "Morning" | "Evening" | "Night";
}

interface ActualAttendance {
    id: string;
    employee_id: string;
    employee_name: string;
    machine_id: string;
    clock_in: string;
    clock_out: string | null;
}

const MachineSchedule: React.FC<{ user?: any }> = ({ user: _user }) => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
    const [selectedShift, setSelectedShift] = useState<"Morning" | "Evening" | "Night" | "All">("All");

    const [machines] = useState<any[]>(MACHINES);
    const [operators, setOperators] = useState<Operator[]>([]);

    const [plannedSchedules, setPlannedSchedules] = useState<PlannedSchedule[]>([]);
    const [actualAttendance, setActualAttendance] = useState<ActualAttendance[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [targetMachine, setTargetMachine] = useState<string | null>(null);
    const [targetShift, setTargetShift] = useState<"Morning" | "Evening" | "Night">("Morning");
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // DND State
    const [draggedOperator, setDraggedOperator] = useState<Operator | null>(null);
    const [dragOverMachine, setDragOverMachine] = useState<string | null>(null);
    const [dragOverShift, setDragOverShift] = useState<"Morning" | "Evening" | "Night" | null>(null);

    useEffect(() => {
        fetchOperators();
    }, []);

    useEffect(() => {
        if (selectedDate) loadScheduleData(selectedDate);
    }, [selectedDate]);

    const fetchOperators = async () => {
        const { data, error } = await supabase
            .from("sys_users_v2")
            .select("employee_id, display_name, position")
            .in("role", ["Operator", "Driver"])
            .order("display_name");
        if (!error && data) setOperators(data);
    };

    const loadScheduleData = async (dateStr: string) => {
        setLoading(true);
        try {
            const { data: planned } = await supabase.from("machine_schedules").select("*").eq("shift_date", dateStr);
            setPlannedSchedules(planned || []);

            const { data: actual } = await supabase
                .from("operator_attendance")
                .select("*")
                .gte("clock_in", \`\${dateStr}T00:00:00Z\`)
                .lt("clock_in", \`\${dateStr}T23:59:59Z\`);
            setActualAttendance(actual || []);
        } catch (error) {
            console.error("Error loading schedule:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAssignModal = (machine: string) => {
        setTargetMachine(machine);
        setTargetShift(selectedShift === "All" ? "Morning" : selectedShift);
        setSelectedOperatorId("");
        setIsAssignModalOpen(true);
    };

    const handleAssignSubmit = async () => {
        if (!targetMachine || !selectedOperatorId) return;
        setIsSubmitting(true);
        const op = operators.find((o) => o.employee_id === selectedOperatorId);
        try {
            const newSchedule = {
                machine_id: targetMachine,
                operator_id: op!.employee_id,
                operator_name: op!.display_name,
                shift_date: selectedDate,
                shift_type: targetShift,
            };
            const { data, error } = await supabase.from("machine_schedules").insert([newSchedule]).select().single();
            if (error) throw error;
            if (data) {
                setPlannedSchedules([...plannedSchedules, data]);
                setIsAssignModalOpen(false);
            }
        } catch (err: any) {
            alert("Failed to save schedule: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!confirm("Remove this operator from the schedule?")) return;
        try {
            const { error } = await supabase.from("machine_schedules").delete().eq("id", id);
            if (!error) setPlannedSchedules(plannedSchedules.filter((s) => s.id !== id));
        } catch (err) {
            console.error("Error deleting:", err);
        }
    };

    const getPlannedForMachine = (machine: string) => {
        let list = plannedSchedules.filter((s) => s.machine_id === machine);
        if (selectedShift !== "All") list = list.filter((s) => s.shift_type === selectedShift);
        return list;
    };

    const getActualForMachine = (machine: string) => {
        return actualAttendance.filter((a) => a.machine_id === machine);
    };

    // DND Handlers
    const handleDragStart = (e: React.DragEvent, op: Operator) => {
        setDraggedOperator(op);
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragOver = (e: React.DragEvent, machineId: string, shift: "Morning" | "Evening" | "Night") => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
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
                shift_type: shift,
            };

            const { data, error } = await supabase.from("machine_schedules").insert([newSchedule]).select().single();
            if (error) throw error;
            if (data) setPlannedSchedules((prev) => [...prev, data]);
        } catch (err: any) {
            alert("Failed to assign operator: " + err.message);
        } finally {
            setIsSubmitting(false);
            setDraggedOperator(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 pb-32 font-sans selection:bg-blue-500/30">
            <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-6">
                
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
                            {operators.map((op) => {
                                const isAssigned = plannedSchedules.some((p) => p.operator_id === op.employee_id);
                                return (
                                    <div
                                        key={op.employee_id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, op)}
                                        onDragEnd={() => setDraggedOperator(null)}
                                        className={\`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:-translate-y-0.5 \${
                                            isAssigned
                                                ? "bg-white/5 border-white/10 opacity-60"
                                                : "bg-blue-900/20 border-blue-500/30 hover:bg-blue-800/30 hover:shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
                                        }\`}
                                    >
                                        <GripVertical size={14} className="text-gray-500" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold text-gray-200 truncate">{op.display_name}</span>
                                            <span className="text-[9px] text-gray-500 font-mono uppercase truncate">{op.position}</span>
                                        </div>
                                        {isAssigned && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" title="Assigned Today" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 flex flex-col gap-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-blue-500 mb-2">
                                <CalendarIcon size={28} className="drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                <h1 className="text-3xl font-black tracking-tighter text-white">Machine Schedule</h1>
                            </div>
                            <p className="text-gray-500 text-sm">Plan operator allocations via dragging and track actual attendance over 3 shifts.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#0d0d12] border border-white/5 p-2 rounded-2xl shadow-xl">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 text-white font-bold"
                            />
                            <select
                                value={selectedShift}
                                onChange={(e) => setSelectedShift(e.target.value as any)}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 text-white font-bold appearance-none cursor-pointer"
                            >
                                <option value="All">All Shifts</option>
                                <option value="Morning">Morning</option>
                                <option value="Evening">Evening</option>
                                <option value="Night">Night</option>
                            </select>
                        </div>
                    </div>

                    {/* Gantt Area */}
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
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-blue-500/30 border border-blue-500/50"/> <span>Plan</span></div>
                                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/> <span>Actual</span></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative h-12 flex items-end">
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
                                    {machines.map((machineItem) => {
                                        const machine = machineItem.id;
                                        const machineName = machineItem.name;
                                        const planned = getPlannedForMachine(machine);
                                        const actuals = getActualForMachine(machine);
                                        const rowMinHeight = Math.max(80, actuals.length > 0 ? actuals.length * 30 + 20 : 80);

                                        return (
                                            <div key={machine} className="flex hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-blue-500 group relative">
                                                <div className="w-56 shrink-0 p-4 border-r border-white/5 flex flex-col justify-center bg-[#0f0f13] z-10">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-blue-500/10 transition-all">
                                                                <Wrench size={18} className="text-gray-400 group-hover:text-blue-400" />
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-lg text-white tracking-tight leading-none mb-1">{machineName}</div>
                                                                <div className="text-[9px] text-gray-500 font-mono uppercase">Production Unit</div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleOpenAssignModal(machine)} className="w-7 h-7 rounded bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100" title="Assign Operator">
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Timeline Area */}
                                                <div className="flex-1 relative py-2 flex" style={{ minHeight: \`\${rowMinHeight}px\` }}>
                                                    {(["Morning", "Evening", "Night"] as const).map((shift) => {
                                                        const isActiveDrop = dragOverMachine === machine && dragOverShift === shift;
                                                        return (
                                                            <div
                                                                key={shift}
                                                                onDragOver={(e) => handleDragOver(e, machine, shift)}
                                                                onDragLeave={handleDragLeave}
                                                                onDrop={(e) => handleDrop(e, machine, shift)}
                                                                className={\`flex-1 h-full border-r border-white/5 relative transition-colors \${ isActiveDrop ? "bg-blue-500/20" : "hover:bg-white/[0.03]" }\`}
                                                            >
                                                                {Array.from({ length: 8 }).map((_, i) => (
                                                                    <div key={i} className="absolute top-0 bottom-0 border-l border-white/[0.03] pointer-events-none" style={{ left: \`\${(i / 8) * 100}%\` }} />
                                                                ))}
                                                            </div>
                                                        );
                                                    })}

                                                    {planned.map((p) => {
                                                        let left = 0; let width = (8 / 24) * 100;
                                                        if (p.shift_type === "Morning") { left = (8 / 24) * 100; } 
                                                        else if (p.shift_type === "Evening") { left = (16 / 24) * 100; }
                                                        else if (p.shift_type === "Night") { left = 0; }

                                                        return (
                                                            <div
                                                                key={p.id}
                                                                className="absolute rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex flex-col justify-center px-3 overflow-hidden group/plan z-20 shadow-lg backdrop-blur-sm"
                                                                style={{ left: \`\${left}%\`, width: \`\${width}%\`, top: "8px", bottom: "8px" }}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[11px] font-bold text-blue-200 truncate">{p.operator_name}</span>
                                                                    <button onClick={() => handleDeleteSchedule(p.id)} className="w-5 h-5 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400 flex items-center justify-center opacity-0 group-hover/plan:opacity-100 transition-opacity bg-black/40">
                                                                        <div className="w-2 h-0.5 bg-current rotate-45 absolute" />
                                                                        <div className="w-2 h-0.5 bg-current -rotate-45 absolute" />
                                                                    </button>
                                                                </div>
                                                                <span className="text-[9px] text-blue-400/50 uppercase tracking-widest font-mono truncate">{p.shift_type}</span>
                                                            </div>
                                                        );
                                                    })}

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
                                                            }
                                                        }

                                                        if (endHour <= startHour) endHour = startHour + 0.1;

                                                        const left = (startHour / 24) * 100;
                                                        const width = ((endHour - startHour) / 24) * 100;
                                                        const isScheduled = planned.some((p) => p.operator_id === a.employee_id);
                                                        const colorClass = isScheduled
                                                            ? "bg-gradient-to-r from-green-500 to-green-400 border-green-500/50 shadow-[0_2px_10px_rgba(34,197,94,0.4)] text-green-950"
                                                            : "bg-gradient-to-r from-orange-500 to-orange-400 border-orange-500/50 shadow-[0_2px_10px_rgba(249,115,22,0.4)] text-orange-950";

                                                        return (
                                                            <div
                                                                key={a.id}
                                                                className={\`absolute h-6 rounded-full border overflow-hidden flex items-center px-2 z-30 transition-transform hover:scale-[1.02] opacity-90 hover:opacity-100 \${colorClass}\`}
                                                                style={{ left: \`\${left}%\`, width: \`\${width}%\`, top: \`\${idx * 28 + 16}px\` }}
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
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f13] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-black text-white">Assign Operator</h2>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-500 hover:text-white">
                                <div className="w-4 h-0.5 bg-current rotate-45 absolute" />
                                <div className="w-4 h-0.5 bg-current -rotate-45 absolute" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Target Machine</label>
                                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold">{machines.find(m => m.id === targetMachine)?.name || targetMachine}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Shift Type</label>
                                <select 
                                    value={targetShift} 
                                    onChange={e => setTargetShift(e.target.value as any)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                >
                                    <option value="Morning">Morning Shift</option>
                                    <option value="Evening">Evening Shift</option>
                                    <option value="Night">Night Shift</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Select Operator</label>
                                <select 
                                    value={selectedOperatorId} 
                                    onChange={e => setSelectedOperatorId(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                >
                                    <option value="" disabled>-- Choose Operator --</option>
                                    {operators.map(op => (
                                        <option key={op.employee_id} value={op.employee_id}>{op.display_name} ({op.position})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-4">
                                <button 
                                    onClick={handleAssignSubmit}
                                    disabled={!selectedOperatorId || isSubmitting}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                >
                                    {isSubmitting ? "Saving..." : "Confirm Assignment"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MachineSchedule;
`;

fs.writeFileSync(path, properlyFormattedComponent);
console.log("Rewrote component to fix all syntax block errors.");

