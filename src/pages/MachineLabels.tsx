import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import QRCode from 'react-qr-code';

interface Machine {
    machine_id: string;
    name: string;
    factory_id: string;
    type: string;
    status: string;
}

const MachineLabels: React.FC = () => {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMachines = async () => {
            try {
                const { data, error } = await supabase
                    .from('sys_machines_v2')
                    .select('*')
                    .order('machine_id');
                if (error) throw error;
                if (data) {
                    setMachines(data as Machine[]);
                }
            } catch (err) {
                console.error("Failed to fetch machines for labels:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMachines();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="text-xl font-bold">Loading machine labels...</div>
            </div>
        );
    }

    const factoryStationLabels: Machine[] = [
        { machine_id: 'FACTORY-TAIPING', name: '太平工厂打卡站 (Taiping Station)', factory_id: 'T1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY-NILAI', name: 'Nilai 工厂打卡站 (Nilai Station)', factory_id: 'N1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY-JOHOR', name: 'Johor 工厂打卡站 (Johor Station)', factory_id: 'J1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY-KELANTAN', name: 'Kelantan 工厂打卡站 (Kelantan Station)', factory_id: 'K1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY_MODE_1', name: '工厂打卡 (计算方式一 班次拆分)', factory_id: 'General', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY_MODE_2', name: '工厂打卡 (计算方式二 RM10固定)', factory_id: 'General', type: 'FactoryStation', status: 'Active' },
    ];

    const allItemsToPrint = [...factoryStationLabels, ...machines];

    return (
        <div id="print-labels-container" className="bg-gray-100 min-h-screen p-8 print:p-0 print:bg-white overflow-x-auto">
            <div className="min-w-[190mm] print:min-w-0 space-y-12 print:space-y-0">
                {allItemsToPrint.map((machine) => (
                    <div
                        key={machine.machine_id}
                        className="page-break-after-always flex items-center justify-center bg-transparent w-[190mm] h-[268.6mm] mx-auto mb-12 print:mb-0 print:w-[210mm] print:h-[297mm] print:p-0 print:m-0"
                    >
                        <div
                            className="bg-white p-12 shadow-2xl rounded-3xl border-8 border-blue-600 flex flex-col items-center justify-between aspect-[1/1.414] w-full h-full print:w-[184mm] print:h-[260mm] print:p-10 print:pb-12 print:border-8 print:rounded-3xl"
                        >
                            {/* Header */}
                            <div className="text-center w-full">
                                <h1 className="text-6xl font-black text-blue-700 tracking-tighter mb-4">
                                    PACK SECURE
                                </h1>
                                <div className="h-1.5 w-full bg-blue-600 rounded-full mb-8"></div>

                                <h2 className="text-4xl font-bold text-gray-800 mb-2">
                                    {machine.type === 'FactoryStation' ? 'FACTORY CHECK-IN STATION' : 'MACHINE STATION'}
                                </h2>
                                <p className="text-6xl font-black text-gray-900 uppercase">
                                    {machine.name}
                                </p>
                            </div>

                            {/* QR CODE */}
                            <div className="flex-1 flex items-center justify-center w-full">
                                <div className="p-4 print:p-6 border-[8px] print:border-[12px] border-gray-900 rounded-[24px] print:rounded-[36px] bg-white shadow-xl flex items-center justify-center w-[280px] h-[280px] print:w-[360px] print:h-[360px]">
                                    <QRCode
                                        value={machine.machine_id}
                                        size={360}
                                        style={{ height: "100%", width: "100%" }}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>
                            </div>

                            {/* Footer & Instructions */}
                            <div className="text-center w-full">
                                <div className="bg-blue-600 text-white py-6 px-12 rounded-2xl mb-8">
                                    <p className="text-4xl font-bold tracking-widest uppercase mb-1">
                                        SCAN FOR CHECK-IN / CHECK-OUT
                                    </p>
                                    <p className="text-xl opacity-90 uppercase font-mono">
                                        ID: {machine.machine_id}
                                    </p>
                                </div>

                                <div className="flex justify-between items-center text-gray-400 text-sm font-bold uppercase tracking-widest">
                                    <span>All Factory Production Operations</span>
                                    <div className="flex gap-4">
                                        <span>v4.0</span>
                                        <span>PackSecure Standard</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Print Button - Hidden on print */}
            <div className="fixed bottom-8 right-8 print:hidden">
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold shadow-2xl hover:bg-blue-700 transition-all flex items-center gap-2 text-xl"
                >
                    <span>Print All Labels (A4)</span>
                </button>
            </div>

            <style>{`
                @media print {
                    /* Reset body & overflow of layout wrappers to allow multi-page printing */
                    html, body, #root, #root > div, .flex.h-screen, main {
                        overflow: visible !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        position: static !important;
                    }
                    /* Hide sidebar, mobile header, floating drawer, and print buttons */
                    aside, 
                    .fixed, 
                    .absolute,
                    button,
                    select,
                    #google_translate_element {
                        display: none !important;
                    }
                    /* Ensure print-labels-container is displayed as a simple block */
                    #print-labels-container {
                        display: block !important;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background-color: white !important;
                    }
                    @page {
                        size: A4;
                        margin: 0 !important; /* 强制消除页端自带的页眉页脚，防重叠 */
                    }
                    body {
                        margin: 0 !important;
                        background-color: white !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .page-break-after-always {
                        page-break-after: always;
                        width: 210mm !important;
                        height: 297mm !important;
                        margin: 0 auto !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default MachineLabels;
