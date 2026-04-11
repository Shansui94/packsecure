import { Machine } from '../types';

export const WAREHOUSES = [
    'SPD',
    'OPM Lama',
    'OPM Corner',
    'OPM Ali',
    'Nilai'
];

export const MACHINES: Machine[] = [
    // Taiping / OPM group
    { id: 'T1.1-M03', name: 'Stretch Film (T1.1)', factory_id: 'OPM Lama', type: 'Extruder', status: 'Running' },
    { id: 'T1.2-M01', name: '2M Double Layer (T1.2)', factory_id: 'OPM Lama', type: 'Extruder', status: 'Running' },
    { id: 'T1.3-M02', name: '1M Single Layer (T1.3)', factory_id: 'OPM Lama', type: 'Extruder', status: 'Idle' },

    // Nilai N1
    { id: 'N1-M01', name: '1M Double Layer (N1)', factory_id: 'Nilai', type: 'Extruder', status: 'Running' },

    { id: 'N2-M02', name: '1M Single Layer (N2)', factory_id: 'Nilai', type: 'Extruder', status: 'Idle' },
];
