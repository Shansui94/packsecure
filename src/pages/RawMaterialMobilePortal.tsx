import React, { useState, useEffect } from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import MachineInspectionModal from '../components/MachineInspectionModal';

interface RawMaterialMobilePortalProps {
    currentUser?: User | null;
    activeFactoryId?: string;
}

export const RawMaterialMobilePortal: React.FC<RawMaterialMobilePortalProps> = ({
    currentUser,
    activeFactoryId
}) => {
    const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
    const [selectedMachineId, setSelectedMachineId] = useState<string>('');
    const [selectedMachineName, setSelectedMachineName] = useState<string>('');

    // 初始获取数据库中的机台列表
    useEffect(() => {
        fetchMachines();
    }, [activeFactoryId]);

    const fetchMachines = async () => {
        try {
            const { data } = await supabase
                .from('sys_machines_v2')
                .select('machine_id, name')
                .order('name');

            if (data && data.length > 0) {
                const list = data.map((m: any) => ({
                    id: m.machine_id,
                    name: m.name || m.machine_id
                }));
                setMachines(list);
            } else {
                const defaultMacs = [
                    { id: 'J1-M01', name: '2M Double Layer (J1)' },
                    { id: 'T2-M01', name: '2M Double Layer (T2)' },
                    { id: 'T1-M03', name: 'Stretch Film (T1)' }
                ];
                setMachines(defaultMacs);
            }
        } catch (e) {
            console.error('Error loading machines:', e);
        }
    };

    const handleSelectMachine = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const mac = machines.find(m => m.id === id);
        if (mac) {
            setSelectedMachineId(mac.id);
            setSelectedMachineName(mac.name);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-3 sm:p-5 space-y-4">
            
            {/* 顶栏机台选择条 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="p-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white">手机端多螺杆配料工作台</h2>
                        <p className="text-[11px] text-gray-400">选择机台进行螺杆配料更改与 Mix 料记录</p>
                    </div>
                </div>

                <div className="relative min-w-[160px]">
                    <select
                        value={selectedMachineId}
                        onChange={handleSelectMachine}
                        className="w-full bg-gray-950 border border-gray-700 text-xs px-3 py-2 rounded-xl text-amber-300 font-bold appearance-none pr-8 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="" disabled>-- 请选择机台 (Select Machine) --</option>
                        {machines.map((mac) => (
                            <option key={mac.id} value={mac.id}>
                                {mac.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-3 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* 嵌入全功能多螺杆配料 Modal 组件 (螺杆 A/B/C、底部照片凭证、单一下拉/写字、修改人审计) */}
            {selectedMachineId ? (
                <div className="relative">
                    <MachineInspectionModal
                        isOpen={true}
                        onClose={() => window.location.href = '/'}
                        machineId={selectedMachineId}
                        machineName={selectedMachineName}
                        currentUser={currentUser}
                        activeFactoryId={activeFactoryId}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 mt-10 border-2 border-dashed border-gray-800 rounded-3xl bg-gray-900/50">
                    <Layers className="w-12 h-12 text-gray-700 mb-4" />
                    <p className="text-gray-400 font-bold text-center">请在上方选择您当前操作的机台<br/><span className="text-xs opacity-50">(Please select a machine above)</span></p>
                </div>
            )}

        </div>
    );
};

export default RawMaterialMobilePortal;
