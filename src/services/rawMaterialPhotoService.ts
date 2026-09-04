import { supabase } from './supabase';

const CACHE_KEY = 'packsecure_raw_material_photos';

// 归一化物料名称，去除多余空白、统一转为大写标准 KEY
export const normalizeMaterialName = (rawName?: string | null): string => {
    if (!rawName) return '';
    return rawName
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
};

// 提取主要特征关键字，例如 "LDPE 2426H" -> "2426", "HDPE / GC 7260" -> "7260"
export const extractMaterialCode = (name: string): string => {
    const norm = normalizeMaterialName(name);
    const matched = norm.match(/\b([A-Z0-9]{3,8})\b/g);
    return matched ? matched.join('-') : norm;
};

export interface MaterialPhotoMap {
    [normalizedName: string]: string; // key: normName/code -> photoUrl
}

// 1. 获取全厂所有原材料的标准包装图片映射表（内存/本地缓存优先，异步与 Supabase 同步）
export const fetchGlobalMaterialPhotos = async (): Promise<Record<string, string>> => {
    const photoMap: Record<string, string> = {};

    // 读取本地缓存
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            Object.assign(photoMap, JSON.parse(cached));
        }
    } catch (e) {
        console.warn('Failed to parse cached material photos:', e);
    }

    try {
        // A. 从 master_items_v2 表拉取已绑定 photo_url 的数据
        const { data: masterData } = await supabase
            .from('master_items_v2')
            .select('sku, name, photo_url')
            .not('photo_url', 'is', null);

        if (masterData && masterData.length > 0) {
            masterData.forEach((item: any) => {
                if (item.photo_url) {
                    if (item.name) {
                        photoMap[normalizeMaterialName(item.name)] = item.photo_url;
                    }
                    if (item.sku) {
                        photoMap[normalizeMaterialName(item.sku)] = item.photo_url;
                    }
                }
            });
        }

        // B. 从 work_photos 表拉取车间配方中录入的 RAW_MATERIAL_STANDARD_PHOTO
        const { data: workPhotosData } = await supabase
            .from('work_photos')
            .select('machine_id, photo_url, user_note, created_at')
            .eq('category', 'RAW_MATERIAL_STANDARD_PHOTO')
            .order('created_at', { ascending: true });

        if (workPhotosData && workPhotosData.length > 0) {
            workPhotosData.forEach((wp: any) => {
                if (wp.photo_url) {
                    if (wp.machine_id) {
                        photoMap[normalizeMaterialName(wp.machine_id)] = wp.photo_url;
                    }
                    if (wp.user_note) {
                        try {
                            const parsed = JSON.parse(wp.user_note);
                            if (parsed.rawName) {
                                photoMap[normalizeMaterialName(parsed.rawName)] = wp.photo_url;
                            }
                        } catch (err) {
                            // ignore json parse
                        }
                    }
                }
            });
        }

        // 更新回本地缓存
        localStorage.setItem(CACHE_KEY, JSON.stringify(photoMap));
    } catch (e) {
        console.error('Error fetching global material photos from cloud:', e);
    }

    return photoMap;
};

// 2. 根据原材料名称在映射库中查找标准包装图片
export const findMaterialStandardPhoto = (
    materialName?: string | null,
    photoMap?: Record<string, string>
): string | null => {
    if (!materialName) return null;
    const map = photoMap || (() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            return cached ? JSON.parse(cached) : {};
        } catch {
            return {};
        }
    })();

    const norm = normalizeMaterialName(materialName);
    // 1) 精准匹配
    if (map[norm]) return map[norm];

    // 2) 包含匹配 / 别名匹配（例如 "LDPE 2426" 匹配 "LDPE 2426H"）
    for (const key of Object.keys(map)) {
        if (norm.includes(key) || key.includes(norm)) {
            return map[key];
        }
    }

    return null;
};

// 3. 沉淀/保存某原材料的标准包装袋照片至全厂共享库
export const saveGlobalMaterialPhoto = async (
    rawName: string,
    photoUrl: string,
    currentUser?: { uid?: string; employeeId?: string; name?: string; email?: string }
): Promise<boolean> => {
    if (!rawName || !photoUrl) return false;

    const normKey = normalizeMaterialName(rawName);
    const uploaderName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Operator';
    const uploaderId = currentUser?.employeeId || currentUser?.uid || 'OP-001';

    try {
        // A. 写入/更新本地缓存，让界面立刻看到
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const map = cached ? JSON.parse(cached) : {};
            map[normKey] = photoUrl;
            localStorage.setItem(CACHE_KEY, JSON.stringify(map));
        } catch (err) {
            console.warn('Local photo map cache update failed:', err);
        }

        // B. 存入 work_photos 确保全厂任何机台与设备无条件即时同步
        await supabase.from('work_photos').insert([{
            employee_id: uploaderId,
            employee_name: uploaderName,
            machine_id: rawName,
            category: 'RAW_MATERIAL_STANDARD_PHOTO',
            user_note: JSON.stringify({
                rawName,
                normKey,
                photoUrl,
                updatedBy: uploaderName,
                updatedAt: new Date().toISOString()
            }),
            photo_url: photoUrl
        }]);

        // C. 同步更新 master_items_v2 表中对应原材料的 photo_url
        try {
            // 尝试精准按名称匹配更新
            await supabase
                .from('master_items_v2')
                .update({ photo_url: photoUrl })
                .ilike('name', `%${rawName}%`);

            // 尝试按 SKU 匹配更新 (如 rawName 包含牌号)
            const code = rawName.split(/[\s/]+/)[0];
            if (code && code.length >= 3) {
                await supabase
                    .from('master_items_v2')
                    .update({ photo_url: photoUrl })
                    .ilike('sku', `%${code}%`);
            }
        } catch (dbErr) {
            console.warn('master_items_v2 photo_url sync skipped or failed:', dbErr);
        }

        return true;
    } catch (e) {
        console.error('Failed to save global material photo:', e);
        return false;
    }
};
