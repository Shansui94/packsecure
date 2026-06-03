import { ProductLayer, ProductMaterial, ProductSize, PackagingColor } from '../types';

export const getRecommendedPackaging = (
    layer: ProductLayer,
    material: ProductMaterial,
    size: ProductSize,
    rolls?: number
): PackagingColor => {
    // 1. 散装/闪装 (Loose/Scattered) 优先逻辑：
    // 如果是小尺寸 (非 100cm) 且选了 x1 (散装)，使用透明小袋
    if (size !== '100cm' && rolls === 1) {
        return 'Transparent';
    }

    // 2. 只有在此基础上，才应用标准捆装的颜色逻辑
    if (layer === 'Single') {
        if (material === 'Black') {
            // 单层黑 100cm -> Green, 50cm -> Pink, 其他 -> Green
            if (size === '100cm') return 'Green';
            return size === '50cm' ? 'Pink' : 'Green';
        } else {
            // 单层透明 100cm -> Pink, 50cm -> Orange, 其他 -> Green
            if (size === '100cm') return 'Pink';
            return size === '50cm' ? 'Orange' : 'Green';
        }
    } else {
        if (material === 'Black') {
            // 双层黑 100cm -> Pink, 50cm -> Green, 其他 -> Pink
            if (size === '100cm') return 'Pink';
            return size === '50cm' ? 'Green' : 'Pink';
        } else {
            // 双层透明 100cm -> Yellow, 其他 -> Blue
            if (size === '100cm') return 'Yellow';
            return 'Blue';
        }
    }
};

export const getRollsPerSet = (size: ProductSize): number => {
    switch (size) {
        case '100cm': return 1;
        case '50cm': return 2;
        case '33cm': return 3;
        case '25cm': return 4;
        case '20cm': return 5;
        default: return 1;
    }
};
