import { useTranslation } from "react-i18next";
import i18next from "i18next";

// ZERO DEPENDENCY CONSTANTS
// Moved here to break circular dependency chains.
// Types are inferred or strictly literal.

export const PRODUCT_LAYERS = [
    { label: i18next.t('Single Layer'), value: 'Single', code: 'SL' },
    { label: i18next.t('Double Layer'), value: 'Double', code: 'DL' },
];

export const PRODUCT_MATERIALS = [
    { label: i18next.t('Clear'), value: 'Clear', code: 'CLR' },
    { label: 'Black (Hitam)', value: 'Black', code: 'BLK' },
];

export const PACKAGING_COLORS = [
    { label: 'Orange (Oren)', value: 'Orange', code: 'ORN', hex: '#FF3D00', class: 'bg-orange-600' }, // Deep Orange A400
    { label: 'Red (Merah)', value: 'Pink', code: 'PNK', hex: '#F50057', class: 'bg-pink-600' }, // Pink A400
    { label: 'Blue (Biru)', value: 'Blue', code: 'BLU', hex: '#2979FF', class: 'bg-blue-600' }, // Blue A400
    { label: 'Yellow (Kuning)', value: 'Yellow', code: 'YEL', hex: '#FFD600', class: 'bg-yellow-400 text-black' }, // Yellow A700
    { label: 'Green (Hijau)', value: 'Green', code: 'GRN', hex: '#00E676', class: 'bg-green-500 text-black' }, // Green A400
    { label: 'Transparent', value: 'Transparent', code: 'TRP', hex: '#FFFFFF', class: 'bg-white text-black' },
];

export const PRODUCT_SIZES = [
    { label: '100cm', value: '100cm', code: '100', rolls: 1 },
    { label: '50cm', value: '50cm', code: '50', rolls: 2 },
    { label: '33cm', value: '33cm', code: '33', rolls: 3 },
    { label: '25cm', value: '25cm', code: '25', rolls: 4 },
    { label: '20cm', value: '20cm', code: '20', rolls: 5 },
];
