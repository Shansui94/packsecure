import { supabase } from './supabase';
import { UniversalIntakeData } from '../types';

const OFFLINE_QUEUE_KEY = 'packsecure_offline_intakes';

/**
 * 离线队列项类型
 */
export interface OfflineIntakeItem {
    id: string;
    timestamp: string;
    parsedData: UniversalIntakeData;
    rawImageUrl?: string;
    speechText?: string;
    gps?: string;
    status: 'pending' | 'syncing' | 'failed';
    error?: string;
}

/**
 * 前端快速生成供 Gemini OCR 优化的轻量缩略图副本（约 150KB - 250KB）
 * 解决工厂弱网环境下大图传输卡顿问题，0.8 秒即可送检
 */
export async function createFastOcrThumbnail(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDimension = 1280;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return resolve(e.target?.result as string);
                }
                ctx.drawImage(img, 0, 0, width, height);
                // 压缩至 0.72 质量，足以看清电子秤和单据文字且体积仅 ~180KB
                const lightweightBase64 = canvas.toDataURL('image/jpeg', 0.72);
                resolve(lightweightBase64);
            };
            img.onerror = () => resolve(e.target?.result as string);
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 后台静默将原始高清大图存入 Supabase Storage 留档存证
 */
export async function uploadOriginalImageToSupabase(file: File | Blob, prefix = 'intake'): Promise<string> {
    try {
        const fileExt = file instanceof File && file.name ? file.name.split('.').pop() : 'jpg';
        const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `universal/${fileName}`;

        // 尝试上传至 work-photos 桶或 avatars 桶
        const targetBucket = 'work-photos';
        let uploadRes = await supabase.storage.from(targetBucket).upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

        if (uploadRes.error) {
            // Fallback to public bucket avatars if work-photos bucket not configured
            uploadRes = await supabase.storage.from('avatars').upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        }

        if (uploadRes.data?.path) {
            const { data } = supabase.storage.from(uploadRes.data.path.startsWith('universal/') ? targetBucket : 'avatars').getPublicUrl(filePath);
            return data.publicUrl;
        }

        return '';
    } catch (err) {
        console.warn('Original image silent upload warning:', err);
        return '';
    }
}

/**
 * 调用后端万能快拍解析接口
 */
export async function parseUniversalIntake(payload: {
    imageBase64?: string;
    rawImageUrl?: string;
    speechText?: string;
    gps?: string;
    timestamp?: string;
    operatorId?: string;
    operatorName?: string;
    context?: any;
}): Promise<UniversalIntakeData> {
    const res = await fetch('/api/agent/universal-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'parse',
            ...payload
        })
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `快拍解析失败 (${res.status})`);
    }

    return await res.json();
}

/**
 * 确认入库提交
 */
export async function commitUniversalIntake(
    parsedData: UniversalIntakeData,
    rawImageUrl?: string,
    speechText?: string
): Promise<{ success: boolean; recordsCreated: any[] }> {
    // 检查网络状态，若离线则直接压入离线队列
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        saveToOfflineQueue({
            id: `offline_${Date.now()}`,
            timestamp: new Date().toISOString(),
            parsedData,
            rawImageUrl,
            speechText,
            gps: parsedData.gps,
            status: 'pending'
        });
        return {
            success: true,
            recordsCreated: [{ table: 'offline_queue', message: '已保存至本地离线暂存队列，网络恢复时自动同步' }]
        };
    }

    try {
        const res = await fetch('/api/agent/universal-intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'commit',
                parsedData,
                rawImageUrl,
                speechText,
                gps: parsedData.gps,
                timestamp: parsedData.timestamp,
                operatorId: parsedData.operatorId,
                operatorName: parsedData.operatorName
            })
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `入库提交失败 (${res.status})`);
        }

        return await res.json();
    } catch (err: any) {
        // 网络异常兜底入离线队列
        saveToOfflineQueue({
            id: `offline_${Date.now()}`,
            timestamp: new Date().toISOString(),
            parsedData,
            rawImageUrl,
            speechText,
            gps: parsedData.gps,
            status: 'pending',
            error: err.message
        });

        return {
            success: true,
            recordsCreated: [{ table: 'offline_queue', message: '已加入本地离线队列，将在网络恢复后重试' }]
        };
    }
}

// -------------------------------------------------------------------
// 离线队列管理 (Offline Queue Management)
// -------------------------------------------------------------------

export function getOfflineQueue(): OfflineIntakeItem[] {
    try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveToOfflineQueue(item: OfflineIntakeItem) {
    const queue = getOfflineQueue();
    queue.push(item);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function syncOfflineQueue(onSyncedItem?: (item: OfflineIntakeItem) => void): Promise<number> {
    const queue = getOfflineQueue();
    if (queue.length === 0) return 0;

    let syncedCount = 0;
    const remaining: OfflineIntakeItem[] = [];

    for (const item of queue) {
        try {
            const res = await fetch('/api/agent/universal-intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'commit',
                    parsedData: item.parsedData,
                    rawImageUrl: item.rawImageUrl,
                    speechText: item.speechText,
                    gps: item.gps,
                    timestamp: item.timestamp
                })
            });

            if (res.ok) {
                syncedCount++;
                if (onSyncedItem) onSyncedItem(item);
            } else {
                remaining.push({ ...item, status: 'failed' });
            }
        } catch {
            remaining.push({ ...item, status: 'failed' });
        }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    return syncedCount;
}

// 监听浏览器网络上线事件自动同步
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('网络已恢复，开始同步万能快拍离线数据...');
        syncOfflineQueue();
    });
}

/**
 * 绑定或登录机台
 */
export function bindOperatorMachine(machineId: string): void {
    if (!machineId) return;
    sessionStorage.setItem('selectedMachine', machineId);
    localStorage.setItem('device_machine_id', machineId);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('packsecure:machine-changed', { detail: machineId }));
    }
}

/**
 * 解绑或登出机台
 */
export function unbindOperatorMachine(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('selectedMachine');
    localStorage.removeItem('device_machine_id');
    localStorage.removeItem('selectedMachine');
    sessionStorage.removeItem('packsecure_operator_machine');
    localStorage.removeItem('packsecure_operator_machine');
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('packsecure:machine-changed', { detail: '' }));
}

/**
 * 获取当前登录或绑定的机台
 */
export function getBoundOperatorMachine(): string {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('selectedMachine') || localStorage.getItem('device_machine_id') || '';
}

/**
 * 获取可用的机台列表
 */
export async function getAvailableMachines(): Promise<{ machine_id: string; name: string }[]> {
    try {
        const { data, error } = await supabase.from('sys_machines_v2').select('machine_id, name').order('name');
        if (!error && data && data.length > 0) {
            return data;
        }
    } catch {
        // fallback
    }

    // Default factory machine list
    return [
        { machine_id: 'T1-1', name: 'T1-1 (Taiping 吹膜1号)' },
        { machine_id: 'T1-2', name: 'T1-2 (Taiping 吹膜2号)' },
        { machine_id: 'T1-3', name: 'T1-3 (Taiping 吹膜3号)' },
        { machine_id: 'N1-1', name: 'N1-1 (Nilai 气泡膜1号)' },
        { machine_id: 'N1-2', name: 'N1-2 (Nilai 气泡膜2号)' },
        { machine_id: 'Rewinder-1', name: 'Rewinder-1 (复卷分切机)' },
        { machine_id: 'Rewinder-2', name: 'Rewinder-2 (复卷分切机2)' }
    ];
}
