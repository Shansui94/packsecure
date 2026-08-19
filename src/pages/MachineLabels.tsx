import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import QRCode from 'react-qr-code';
import { useTranslation } from "react-i18next";

interface Machine {
    machine_id: string;
    name: string;
    factory_id: string;
    type: string;
    status: string;
}

const MachineLabels: React.FC = () => {
    const { t } = useTranslation();
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
        { machine_id: 'FACTORY-TAIPING', name: t('Taiping Factory Check-in Station (Taiping Station)'), factory_id: 'T1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY-NILAI', name: t('Nilai Factory Check-in Station (Nilai Station)'), factory_id: 'N1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY-JOHOR', name: t('Johor Factory Check-in Station (Johor Station)'), factory_id: 'J1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY-KELANTAN', name: t('Kelantan Factory Check-in Station (Kelantan Station)'), factory_id: 'K1', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY_MODE_1', name: t('Factory punch-in (calculation method 1: shift split)'), factory_id: 'General', type: 'FactoryStation', status: 'Active' },
        { machine_id: 'FACTORY_MODE_2', name: t('Factory punch-in (calculation method 2: fixed at RM10)'), factory_id: 'General', type: 'FactoryStation', status: 'Active' },
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

            <style>{t('@media print {\n                    /* Reset body & overflow of layout wrappers to allow multi-page printing */\n                    html, body, #root, #root > div, .flex.h-screen, main {\n                        overflow: visible !important;\n                        height: auto !important;\n                        min-height: 0 !important;\n                        max-height: none !important;\n                        position: static !important;\n                    }\n                    /* Hide sidebar, mobile header, floating drawer, and print buttons */\n                    aside,\n                    .fixed,\n                    .absolute,\n                    button,\n                    select,\n                    #google_translate_element {\n                        display: none !important;\n                    }\n                    /* Ensure print-labels-container is displayed as a simple block */\n                    #print-labels-container {\n                        display: block !important;\n                        width: 100% !important;\n                        padding: 0 !important;\n                        margin: 0 !important;\n                        background-color: white !important;\n                    }\n                    @page {\n                        size: A4;\n                        margin: 0 !important; /* Forcibly eliminate the header and footer that comes with the page to prevent overlap */\n                    }\n                    body {\n                        margin: 0 !important;\n                        background-color: white !important;\n                        -webkit-print-color-adjust: exact;\n                    }\n                    .page-break-after-always {\n                        page-break-after: always;\n                        width: 210mm !important;\n                        height: 297mm !important;\n                        margin: 0 auto !important;\n                    }\n                }')}</style>
        </div>
    );
};

export default MachineLabels;
