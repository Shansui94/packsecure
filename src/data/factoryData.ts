import { Machine } from '../types';

export const WAREHOUSES = [
    'SPD',
    'OPM Lama',
    'OPM Corner',
    'OPM Ali',
    'Nilai',
    'Kelantan',
    'Johor'
];

export const MACHINES: Machine[] = [
    // Taiping / OPM group
    { id: 'T1-M03', name: 'Stretch Film (T1)', factory_id: 'OPM Lama', type: 'Extruder', status: 'Running' },
    { id: 'T2-M01', name: '2M Double Layer (T2)', factory_id: 'OPM Lama', type: 'Extruder', status: 'Running' },
    { id: 'T3-M02', name: '1M Single Layer (T3)', factory_id: 'OPM Lama', type: 'Extruder', status: 'Idle' },
    { id: 'T4-M04', name: 'Stretch Film (T4)', factory_id: 'OPM Lama', type: 'Extruder', status: 'Idle' },
    { id: 'T5-M05', name: 'Recycle Machine (T5)', factory_id: 'OPM Lama', type: 'Other', status: 'Idle' },

    // Nilai
    { id: 'N1-M01', name: '1M Double Layer (N1)', factory_id: 'Nilai', type: 'Extruder', status: 'Running' },
    { id: 'N2-M02', name: '1M Single Layer (N2)', factory_id: 'Nilai', type: 'Extruder', status: 'Idle' },
    { id: 'N3-M03', name: 'Recycle Machine (N3)', factory_id: 'Nilai', type: 'Other', status: 'Idle' },

    // Kelantan
    { id: 'K1-M01', name: '1M Double Layer (K1)', factory_id: 'Kelantan', type: 'Extruder', status: 'Idle' },
    { id: 'K1-M02', name: '1M Single Layer (K1)', factory_id: 'Kelantan', type: 'Extruder', status: 'Idle' },

    // Johor
    { id: 'J1-M01', name: '2M Double Layer (J1)', factory_id: 'Johor', type: 'Extruder', status: 'Idle' },
    { id: 'J1-M02', name: '1M Single Layer (J1)', factory_id: 'Johor', type: 'Extruder', status: 'Idle' }
];
