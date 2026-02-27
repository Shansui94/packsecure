import { ProductLayer, ProductMaterial, ProductSize, PackagingColor } from '../types';

/** Maps PackagingColor → 3-letter pack code */
const PACK_CODE: Record<PackagingColor, string> = {
    'Orange': 'ORN',
    'Pink': 'RED',   // Pink = Red/Merah internally
    'Blue': 'BLU',
    'Yellow': 'YEL',
    'Green': 'GRN',
    'Transparent': 'TRP',
};

/** Maps ProductMaterial → 3-letter material code */
const MAT_CODE: Record<string, string> = {
    'Clear': 'CLR',
    'Black': 'BLK',
    'Silver': 'SLR',
    'Yellow': 'YLW',  // Yellow material (distinct from YEL packaging)
};

/** Maps ProductSize → { widthCm, rolls } */
const SIZE_MAP: Record<string, { width: number; rolls: number }> = {
    '100cm': { width: 100, rolls: 1 },
    '50cm': { width: 50, rolls: 2 },
    '33cm': { width: 33, rolls: 3 },
    '25cm': { width: 25, rolls: 4 },
    '20cm': { width: 20, rolls: 5 },
};

/**
 * Generates the canonical bubble-wrap SKU.
 *
 * Format: BW-{Layer}-{Mat}-100Mx{W}CMx{R}ROLL[-{Pack}]
 * Example: BW-SL-BLK-100Mx100CMx1ROLL-GRN
 *
 * - Layer:   SL (Single) | DL (Double)
 * - Mat:     CLR | BLK | SLV | YLW
 * - Width:   100 / 50 / 33 / 25 / 20 (cm)
 * - Rolls:   derived from size (override supported)
 * - Pack:    RED | ORN | BLU | YEL | GRN | TRP  (omitted when null)
 */
export const getBubbleWrapSku = (
    layer: ProductLayer,
    material: ProductMaterial,
    size: ProductSize | null,
    rolls?: number,
    color?: PackagingColor | null,
): string => {
    if (!size) return 'BW-UNKNOWN';

    const layerCode = layer === 'Double' ? 'DL' : 'SL';
    const matCode = MAT_CODE[material] ?? material.toUpperCase().slice(0, 3);
    const sizeInfo = SIZE_MAP[size] ?? { width: parseInt(size), rolls: 1 };
    const width = sizeInfo.width;
    const rollCount = rolls ?? sizeInfo.rolls;

    const base = `BW-${layerCode}-${matCode}-100Mx${width}CMx${rollCount}ROLL`;

    if (color && color !== 'Transparent') {
        return `${base}-${PACK_CODE[color]}`;
    }
    if (color === 'Transparent') {
        return `${base}-TRP`;
    }
    // No color specified → omit suffix
    return base;
};
