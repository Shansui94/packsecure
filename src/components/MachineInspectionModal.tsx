import React, { useState, useEffect, useRef } from 'react';
import {
    Camera,
    CheckCircle2,
    History,
    Wrench,
    Thermometer,
    Package,
    X,
    Trash2,
    PlusCircle,
    Layers,
    Loader,
    UserCheck
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { User, MobileInspectionLog } from '../types';
import { logActivity } from '../utils/logger';
import { compressImage } from '../utils/imageCompress';
import { useTranslation } from 'react-i18next';

interface MachineInspectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    machineId: string;
    machineName: string;
    currentUser?: User | null;
    activeFactoryId?: string;
}

type ScrewType = 'Screw_A' | 'Screw_B' | 'Screw_C';

interface MaterialItemState {
    id: string;
    name: string;
    sku: string;
    unit: '包' | 'kg'; // 1 包 = 25kg
    prevQty: number;
    newQty: number;
    photoUrl?: string; // 📷 物料包装外袋/实物照片
}

// 螺杆配置信息
const SCREW_CONFIGS: { id: ScrewType; name: string; tag: string; color: string }[] = [
    { id: 'Screw_A', name: '螺杆 A (Screw A)', tag: '外层/主螺杆', color: 'from-rose-600 to-red-700' },
    { id: 'Screw_B', name: '螺杆 B (Screw B)', tag: '中层/辅螺杆', color: 'from-blue-600 to-cyan-700' },
    { id: 'Screw_C', name: '螺杆 C (Screw C)', tag: '内层 (2m大机器)', color: 'from-emerald-600 to-teal-700' },
];

// 工厂系统默认常用原材料预设库
const MASTER_RAW_MATERIAL_PRESETS = [
    'LDPE 2426H',
    'LDPE 6238',
    'HDPE / GC 7260',
    'HDPE 聚乙烯料',
    'C1802 / 7042',
    'L1220F / 1218WJ',
    '2192J / 18020SA / L1220F',
    'Recycle (碎料/回料)',
    'Black (黑母粒)',
    'Plastic (透明塑料料)',
    'White (白母粒)',
    'Anti-static (防静电剂)',
];

// 工厂现场手写纸初始预设（1包 = 25kg）
const INITIAL_PRESET_MATERIALS: Record<ScrewType, MaterialItemState[]> = {
    Screw_A: [
        { id: 'a1', name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: '包', prevQty: 3, newQty: 3 },
        { id: 'a2', name: 'LDPE 6238', sku: 'RM-LDPE-6238', unit: '包', prevQty: 1, newQty: 1 },
        { id: 'a3', name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: '包', prevQty: 5, newQty: 5 },
        { id: 'a4', name: 'C1802 / 7042', sku: 'RM-C1802', unit: '包', prevQty: 8, newQty: 8 },
        { id: 'a5', name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: '包', prevQty: 5, newQty: 5 },
        { id: 'a6', name: 'Recycle (碎料/回料)', sku: 'RM-RECYCLE', unit: 'kg', prevQty: 10, newQty: 10 },
        { id: 'a7', name: 'Black (黑母粒)', sku: 'RM-MB-BLACK', unit: 'kg', prevQty: 16, newQty: 16 },
    ],
    Screw_B: [
        { id: 'b1', name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: '包', prevQty: 3, newQty: 3 },
        { id: 'b2', name: 'HDPE 聚乙烯料', sku: 'RM-HDPE-BASE', unit: '包', prevQty: 6, newQty: 6 },
        { id: 'b3', name: '2192J / 18020SA / L1220F', sku: 'RM-MIX-2192J', unit: '包', prevQty: 4, newQty: 4 },
        { id: 'b4', name: 'C1802 / 7042', sku: 'RM-C1802', unit: '包', prevQty: 11, newQty: 11 },
        { id: 'b5', name: 'Recycle (碎料/回料)', sku: 'RM-RECYCLE', unit: 'kg', prevQty: 20, newQty: 20 },
        { id: 'b6', name: 'Plastic (透明塑料料)', sku: 'RM-PLASTIC', unit: 'kg', prevQty: 10, newQty: 10 },
    ],
    Screw_C: [
        { id: 'c1', name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: '包', prevQty: 3, newQty: 3 },
        { id: 'c2', name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: '包', prevQty: 5, newQty: 5 },
        { id: 'c3', name: 'C1802 / 7042', sku: 'RM-C1802', unit: '包', prevQty: 8, newQty: 8 },
        { id: 'c4', name: 'Recycle (碎料/回料)', sku: 'RM-RECYCLE', unit: 'kg', prevQty: 15, newQty: 15 },
    ]
};

// 预设机器调整位置
const PRESET_POSITIONS = [
    '风环高度 (Air Ring Height)',
    '模头间隙 (Die Head Gap)',
    '牵引刀位置 (Nip Roller / Cutter)',
    '纠偏感应轴 (Web Guide Sensor)',
    '气胀轴 / 收卷位置 (Air Shaft / Winder)',
    '自定义位置 (Custom Location)'
];

export const MachineInspectionModal: React.FC<MachineInspectionModalProps> = ({
    isOpen,
    onClose,
    machineId,
    machineName,
    currentUser,
    activeFactoryId
}) => {
    const { t } = useTranslation();
    // 螺杆选择状态
    const [selectedScrew, setSelectedScrew] = useState<ScrewType>('Screw_A');
    const [activeTab, setActiveTab] = useState<'materials' | 'adjustment' | 'temperature' | 'logs'>('materials');
    const [logs, setLogs] = useState<MobileInspectionLog[]>([]);

    // 云端数据库中的标准原材料列表
    const [dbRawMaterials, setDbRawMaterials] = useState<string[]>(MASTER_RAW_MATERIAL_PRESETS);

    // 螺杆整组 Mix 料照片凭证
    const [screwHopperPhotos, setScrewHopperPhotos] = useState<Record<ScrewType, string>>({
        Screw_A: '',
        Screw_B: '',
        Screw_C: ''
    });

    // 各螺杆动态配方 State
    const [screwMaterials, setScrewMaterials] = useState<Record<ScrewType, MaterialItemState[]>>(INITIAL_PRESET_MATERIALS);

    // 归一化机台 KEY，防止电脑端 (如 'J1-M01' / '2M Double Layer (J1)') 与 手机端 (如 'J1') 命名差异导致的隔离
    const getNormalizedMachineKey = (mId?: string, mName?: string): string => {
        const raw = mId || mName || 'J1';
        const matchParen = raw.match(/\(([^)]+)\)/);
        let key = raw;
        if (matchParen && matchParen[1]) {
            key = matchParen[1].trim();
        }
        if (key.includes('-')) {
            key = key.split('-')[0];
        }
        return key.toUpperCase().trim();
    };

    // 🔑 当 Modal 打开或 machineId 切换时，从云端 Supabase (work_photos: MACHINE_SCREW_FORMULA) 同步加载配方
    useEffect(() => {
        if (!isOpen || (!machineId && !machineName)) return;
        const normKey = getNormalizedMachineKey(machineId, machineName);

        const loadFormula = async () => {
            let localMat: any = null;
            try {
                const saved = localStorage.getItem(`active_screw_materials_${normKey}`);
                if (saved) {
                    localMat = JSON.parse(saved);
                    setScrewMaterials(localMat);
                } else {
                    setScrewMaterials(INITIAL_PRESET_MATERIALS);
                }
            } catch (e) {
                console.error('Failed to load saved materials locally:', normKey, e);
                setScrewMaterials(INITIAL_PRESET_MATERIALS);
            }

            // 从云端 work_photos 表拉取最新跨端同步配方
            try {
                const { data } = await supabase
                    .from('work_photos')
                    .select('user_note')
                    .eq('category', 'MACHINE_SCREW_FORMULA')
                    .or(`machine_id.eq.${normKey},machine_id.ilike.${normKey}-%`)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (data && data.length > 0 && data[0].user_note) {
                    const cloudMaterials = JSON.parse(data[0].user_note);
                    setScrewMaterials(cloudMaterials);
                    localStorage.setItem(`active_screw_materials_${normKey}`, JSON.stringify(cloudMaterials));
                } else if (localMat) {
                    syncScrewMaterialsToCloud(localMat);
                }
            } catch (e) {
                console.warn('Cloud formula load skipped:', e);
            }
        };

        loadFormula();
    }, [isOpen, machineId, machineName]);

    // 每次修改配方，同步写入云端 work_photos
    const syncScrewMaterialsToCloud = async (newMaterials: Record<ScrewType, MaterialItemState[]>) => {
        setScrewMaterials(newMaterials);
        const normKey = getNormalizedMachineKey(machineId, machineName);

        try {
            localStorage.setItem(`active_screw_materials_${normKey}`, JSON.stringify(newMaterials));
        } catch (e) {
            console.error('Failed to save materials locally:', e);
        }

        try {
            await supabase.from('work_photos').insert([{
                employee_id: currentUser?.uid || 'OP-001',
                employee_name: currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员',
                machine_id: normKey,
                category: 'MACHINE_SCREW_FORMULA',
                user_note: JSON.stringify(newMaterials),
                photo_url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80'
            }]);
        } catch (e) {
            console.warn('Cloud formula save skipped:', e);
        }
    };

    const masterHopperPhotoInputRef = useRef<HTMLInputElement>(null);

    // 增加新物料表单
    const [showAddMatForm, setShowAddMatForm] = useState(false);
    const [newMatName, setNewMatName] = useState('');
    const [newMatQty, setNewMatQty] = useState<number>(3);
    const [newMatUnit, setNewMatUnit] = useState<'包' | 'kg'>('包');

    // 提交保存状态
    const [isSavingFullRecipe, setIsSavingFullRecipe] = useState(false);

    // 机器调整表单
    const [adjPosition, setAdjPosition] = useState(PRESET_POSITIONS[0]);
    const [adjCustomPos, setAdjCustomPos] = useState('');
    const [adjNotes, setAdjNotes] = useState('');
    const [adjPhotoUrl, setAdjPhotoUrl] = useState('');

    // 温度表单
    const [tempZone1, setTempZone1] = useState(175);
    const [tempZone2, setTempZone2] = useState(180);
    const [tempZone3, setTempZone3] = useState(185);
    const [tempDieHead, setTempDieHead] = useState(190);
    const [tempStatus, setTempStatus] = useState<'normal' | 'overheat' | 'too_low'>('normal');
    const [tempPhotoUrl, setTempPhotoUrl] = useState('');

    // 照片大图 Lightbox
    const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

    // 初始加载数据库日志 & 原材料清单
    useEffect(() => {
        if (isOpen) {
            fetchMachineLogs();
            fetchDbRawMaterials();
        }
    }, [isOpen, machineId, machineName]);

    // 从 Supabase `items` 表（type = 'raw'）拉取全厂原材料数据
    const fetchDbRawMaterials = async () => {
        try {
            const { data } = await supabase
                .from('items')
                .select('name')
                .eq('type', 'raw');

            if (data && data.length > 0) {
                const namesFromDb = data.map(i => i.name).filter(Boolean);
                const merged = Array.from(new Set([...namesFromDb, ...MASTER_RAW_MATERIAL_PRESETS]));
                setDbRawMaterials(merged);
            }
        } catch (e) {
            console.error('Fetch raw materials error:', e);
        }
    };

    // 辅助工具：保存日志到 State，同时全量同步写入 Supabase work_photos 表
    const saveLogToLocalAndState = async (newLog: MobileInspectionLog) => {
        setLogs(prev => [newLog, ...prev]);

        // 云端全同步：写一份到 work_photos 确保任何端（电脑与手机）均能拉取
        try {
            const normKey = getNormalizedMachineKey(machineId, machineName);
            await supabase.from('work_photos').insert([{
                employee_id: currentUser?.uid || 'OP-001',
                employee_name: currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员',
                machine_id: normKey,
                category: 'MACHINE_INSPECTION_LOG',
                user_note: JSON.stringify(newLog),
                photo_url: newLog.photo_url || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80'
            }]);
        } catch (e) {
            console.warn('Cloud log save skipped:', e);
        }
    };

    // 🔒 严格隔离：从 Supabase 云端 work_photos 表全量读取该机台的日志，保证多设备（电脑与手机）百分之百绝对同步
    const fetchMachineLogs = async () => {
        if (!machineId && !machineName) {
            setLogs([]);
            return;
        }

        const normKey = getNormalizedMachineKey(machineId, machineName);

        let cloudLogs: MobileInspectionLog[] = [];
        try {
            // 支持精准格式 ('T2') 与完整数据库格式 ('T2-M01') 的复合查询
            const { data } = await supabase
                .from('work_photos')
                .select('user_note, created_at')
                .eq('category', 'MACHINE_INSPECTION_LOG')
                .or(`machine_id.eq.${normKey},machine_id.ilike.${normKey}-%`)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data && data.length > 0) {
                cloudLogs = data.map((item: any) => {
                    try {
                        const parsed = JSON.parse(item.user_note);
                        return {
                            ...parsed,
                            created_at: parsed.created_at || item.created_at
                        };
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
            }
        } catch (e) {
            console.warn('DB fetch logs skipped:', e);
        }

        // 去重并按最新时间倒序排列
        const combinedMap = new Map<string, MobileInspectionLog>();
        cloudLogs.forEach((l: any) => {
            const key = l.id || `${l.created_at}_${l.material_name}`;
            if (!combinedMap.has(key)) combinedMap.set(key, l);
        });

        const finalLogs = Array.from(combinedMap.values()).sort((a, b) => 
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        setLogs(finalLogs);
    };

    if (!isOpen) return null;

    const currentScrewConfig = SCREW_CONFIGS.find(s => s.id === selectedScrew) || SCREW_CONFIGS[0];
    const currentMaterials = screwMaterials[selectedScrew] || [];
    const currentHopperPhoto = screwHopperPhotos[selectedScrew];

    // ➕ 手动在上方增加物料
    const handleAddMaterial = async () => {
        const name = newMatName.trim();
        if (!name) {
            alert('请选择或打字输入物料名称！');
            return;
        }

        const newId = Date.now().toString();
        const newItem: MaterialItemState = {
            id: newId,
            name: name,
            sku: `RM-${name.replace(/\s+/g, '-').toUpperCase()}`,
            unit: newMatUnit,
            prevQty: newMatQty,
            newQty: newMatQty
        };

        const updatedMaterials = {
            ...screwMaterials,
            [selectedScrew]: [...(screwMaterials[selectedScrew] || []), newItem]
        };
        syncScrewMaterialsToCloud(updatedMaterials);

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员';

        // 写入 [更改配方 - 新增物料] 日志存库
        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: `添加物料: ${name} (${newMatQty}${newMatUnit})`,
            new_quantity: newMatQty,
            reaction_notes: `更改配方 | 操作人: ${operatorName}`,
            photo_url: currentHopperPhoto || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80',
            operator_id: currentUser?.uid,
            operator_name: operatorName,
            operator_role: currentUser?.role || 'Operator',
            factory_id: activeFactoryId,
            created_at: new Date().toISOString()
        };

        try {
            const { data } = await supabase.from('mobile_inspection_logs').insert([newLog]).select();
            saveLogToLocalAndState(data && data[0] ? data[0] : newLog);

            logActivity(currentUser, 'ADD_MATERIAL_ITEM', {
                machine: machineName,
                screw: selectedScrew,
                material: name,
                qty: newMatQty
            });
        } catch (e) {
            console.error('Log add material error:', e);
            saveLogToLocalAndState(newLog);
        }

        setNewMatName('');
        setShowAddMatForm(false);
    };

    // 🗑️ 手动在上方删减物料
    const handleRemoveMaterial = async (id: string) => {
        const targetMat = currentMaterials.find(m => m.id === id);
        const matName = targetMat ? targetMat.name : '物料';

        const updatedMaterials = {
            ...screwMaterials,
            [selectedScrew]: (screwMaterials[selectedScrew] || []).filter(m => m.id !== id)
        };
        syncScrewMaterialsToCloud(updatedMaterials);

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员';

        // 写入 [更改配方 - 删除物料] 日志存库
        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: `删除物料: ${matName}`,
            new_quantity: 0,
            reaction_notes: `更改配方 | 操作人: ${operatorName}`,
            photo_url: currentHopperPhoto || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80',
            operator_id: currentUser?.uid,
            operator_name: operatorName,
            operator_role: currentUser?.role || 'Operator',
            factory_id: activeFactoryId,
            created_at: new Date().toISOString()
        };

        try {
            const { data } = await supabase.from('mobile_inspection_logs').insert([newLog]).select();
            saveLogToLocalAndState(data && data[0] ? data[0] : newLog);

            logActivity(currentUser, 'DELETE_MATERIAL_ITEM', {
                machine: machineName,
                screw: selectedScrew,
                material: matName
            });
        } catch (e) {
            console.error('Log delete material error:', e);
            saveLogToLocalAndState(newLog);
        }
    };

    // ✏️ 手动在上方更新数量
    const handleUpdateQty = async (id: string, qty: number) => {
        const targetMat = currentMaterials.find(m => m.id === id);
        if (!targetMat) return;

        const validQty = Math.max(0, qty);
        const oldQty = targetMat.newQty;
        if (oldQty === validQty) return;

        const updatedMaterials = {
            ...screwMaterials,
            [selectedScrew]: (screwMaterials[selectedScrew] || []).map(m => m.id === id ? { ...m, prevQty: oldQty, newQty: validQty } : m)
        };
        syncScrewMaterialsToCloud(updatedMaterials);

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员';
        const delta = validQty - oldQty;

        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: `调整数量: ${targetMat.name} (${oldQty} ➔ ${validQty} ${targetMat.unit})`,
            previous_quantity: oldQty,
            new_quantity: validQty,
            change_amount: delta,
            reaction_notes: `更改配方数量 | 操作人: ${operatorName}`,
            photo_url: currentHopperPhoto || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80',
            operator_id: currentUser?.uid,
            operator_name: operatorName,
            operator_role: currentUser?.role || 'Operator',
            factory_id: activeFactoryId,
            created_at: new Date().toISOString()
        };

        try {
            const { data } = await supabase.from('mobile_inspection_logs').insert([newLog]).select();
            saveLogToLocalAndState(data && data[0] ? data[0] : newLog);

            logActivity(currentUser, 'UPDATE_MATERIAL_QTY', {
                machine: machineName,
                screw: selectedScrew,
                material: targetMat.name,
                oldQty: oldQty,
                newQty: validQty
            });
        } catch (e) {
            console.error('Log update qty error:', e);
            saveLogToLocalAndState(newLog);
        }
    };

    // 手动切换单位
    const handleToggleUnit = (id: string) => {
        setScrewMaterials(prev => ({
            ...prev,
            [selectedScrew]: (prev[selectedScrew] || []).map(m => {
                if (m.id === id) {
                    return { ...m, unit: m.unit === '包' ? 'kg' : '包' };
                }
                return m;
            })
        }));
    };

    // 辅助工具：上传照片 DataURL 到 Supabase work-photos 存储桶，获取跨端永久访问的 URL
    const uploadPhotoBlobToSupabase = async (compressedDataUrl: string): Promise<string> => {
        try {
            if (!compressedDataUrl || !compressedDataUrl.startsWith('data:')) return compressedDataUrl;
            const res = await fetch(compressedDataUrl);
            const blob = await res.blob();
            const uploaderId = currentUser?.employeeId || currentUser?.uid || 'OP';
            const fileName = `item_photo_${uploaderId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
            const { error } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: blob.type || 'image/jpeg' });

            if (!error) {
                const { data } = supabase.storage.from('work-photos').getPublicUrl(fileName);
                if (data?.publicUrl) return data.publicUrl;
            }
        } catch (e) {
            console.warn('Supabase storage photo upload fallback:', e);
        }
        return compressedDataUrl;
    };

    // 📷 拍摄或上传单项物料包装/外袋照片
    const handleItemPhotoUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const compressed = await compressImage(e.target.files[0], 1024, 0.7);
                const cloudUrl = await uploadPhotoBlobToSupabase(compressed);
                const updated = {
                    ...screwMaterials,
                    [selectedScrew]: (screwMaterials[selectedScrew] || []).map(m => m.id === id ? { ...m, photoUrl: cloudUrl } : m)
                };
                syncScrewMaterialsToCloud(updated);
            } catch (err) {
                console.error('Item photo upload error:', err);
            }
        }
    };

    // 📸 底部上传料斗实物 Mix 料照片凭证
    const handleHopperPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            try {
                const compressed = await compressImage(e.target.files[0], 1024, 0.7);
                const cloudUrl = await uploadPhotoBlobToSupabase(compressed);
                setScrewHopperPhotos(prev => ({
                    ...prev,
                    [selectedScrew]: cloudUrl
                }));
            } catch (err) {
                console.error(err);
            }
        }
    };

    // 💾 【底部：操作员 Mix 料混料操作记录提交】
    const handleSubmitFullScrewRecipe = async () => {
        if (!currentHopperPhoto) {
            alert(`📸 请先在下方拍摄/上传 [${currentScrewConfig.name}] Mix料完成后的料斗实物或照片凭证！`);
            return;
        }

        setIsSavingFullRecipe(true);
        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员';
        const operatorIdStr = currentUser?.uid || localStorage.getItem('operatorId') || 'OP-UNKNOWN';

        const mixDetailsText = currentMaterials.map(m => `${m.name}: ${m.newQty}${m.unit}`).join(', ');

        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: `完成 Mix 配方 (${mixDetailsText})`,
            new_quantity: currentMaterials.length,
            reaction_notes: `Mix料记录 | 操作员: ${operatorName} (${operatorIdStr}) | 共 ${currentMaterials.length} 项`,
            photo_url: currentHopperPhoto,
            operator_id: currentUser?.uid,
            operator_name: operatorName,
            operator_role: currentUser?.role || 'Operator',
            factory_id: activeFactoryId,
            created_at: new Date().toISOString()
        };

        try {
            const { data } = await supabase.from('mobile_inspection_logs').insert([newLog]).select();
            saveLogToLocalAndState(data && data[0] ? data[0] : newLog);

            logActivity(currentUser, 'OPERATOR_MIX_MATERIAL_SUBMIT', {
                machine: machineName,
                screw: selectedScrew,
                operator: operatorName,
                mixDetails: mixDetailsText,
                materialsCount: currentMaterials.length
            });

            alert(`✅ 成功提交并记录 [${currentScrewConfig.name}] Mix料操作！\nMix料操作员: ${operatorName}\n实际 Mix 了: ${mixDetailsText}`);
        } catch (e) {
            console.error('Submit mix record error:', e);
            saveLogToLocalAndState(newLog);
            alert(`✅ 已在本地保存 [${currentScrewConfig.name}] Mix料记录！`);
        } finally {
            setIsSavingFullRecipe(false);
        }
    };

    // 提交位置调整
    const handleSubmitAdjustment = async () => {
        if (!adjPhotoUrl) {
            alert('📸 请拍摄机器位置调整现场证明照片！');
            return;
        }

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员';
        const targetPos = adjPosition === '自定义位置 (Custom Location)' ? adjCustomPos : adjPosition;

        const newLog: MobileInspectionLog = {
            log_type: 'machine_adjustment',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            adjustment_position: targetPos,
            adjustment_notes: adjNotes,
            photo_url: adjPhotoUrl,
            operator_id: currentUser?.uid,
            operator_name: operatorName,
            operator_role: currentUser?.role || 'Operator',
            factory_id: activeFactoryId,
            created_at: new Date().toISOString()
        };

        try {
            const { data } = await supabase.from('mobile_inspection_logs').insert([newLog]).select();
            saveLogToLocalAndState(data && data[0] ? data[0] : newLog);

            alert(`✅ 机器 [${machineName}] 位置调整已成功存库！`);
            setAdjPhotoUrl('');
            setAdjNotes('');
        } catch (e) {
            console.error(e);
            saveLogToLocalAndState(newLog);
            alert(`✅ 机器 [${machineName}] 位置调整已在本地保存！`);
            setAdjPhotoUrl('');
            setAdjNotes('');
        }
    };

    // 提交温度
    const handleSubmitTemperature = async () => {
        if (!tempPhotoUrl) {
            alert('📸 请拍摄温度控制面板/仪表照片！');
            return;
        }

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员';

        const newLog: MobileInspectionLog = {
            log_type: 'temperature',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            temp_zone_1: tempZone1,
            temp_zone_2: tempZone2,
            temp_zone_3: tempZone3,
            temp_die_head: tempDieHead,
            temp_status: tempStatus,
            photo_url: tempPhotoUrl,
            operator_id: currentUser?.uid,
            operator_name: operatorName,
            operator_role: currentUser?.role || 'Operator',
            factory_id: activeFactoryId,
            created_at: new Date().toISOString()
        };

        try {
            const { data } = await supabase.from('mobile_inspection_logs').insert([newLog]).select();
            saveLogToLocalAndState(data && data[0] ? data[0] : newLog);

            alert(`✅ 机器 [${machineName}] (${currentScrewConfig.name}) 温度照片已保存！`);
            setTempPhotoUrl('');
        } catch (e) {
            console.error(e);
            saveLogToLocalAndState(newLog);
            alert(`✅ 机器 [${machineName}] (${currentScrewConfig.name}) 温度照片已在本地保存！`);
            setTempPhotoUrl('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
            <div className="bg-gray-900 border border-gray-800 rounded-t-3xl sm:rounded-2xl w-full max-w-xl p-4 sm:p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl relative pb-20 sm:pb-20">
                
                {/* Header 机台与标题 */}
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                            <Layers size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white text-base flex items-center gap-2">
                                <span>{machineName}</span>
                            </h3>
                            <p className="text-xs text-gray-400">{t('选择螺杆通道配置混料配方及巡检')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition">
                        <X size={18} />
                    </button>
                </div>

                {/* 螺杆 A / B / C 通道切换 */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                        <Layers size={13} className="text-indigo-400" />
                        {t('选择目标螺杆通道')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {SCREW_CONFIGS.map((screw) => {
                            const isSelected = selectedScrew === screw.id;

                            return (
                                <button
                                    key={screw.id}
                                    onClick={() => setSelectedScrew(screw.id)}
                                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center ${isSelected
                                        ? `bg-gradient-to-br ${screw.color} text-white border-white/30 shadow-md`
                                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                                        }`}
                                >
                                    <span className="font-medium text-xs">{screw.name.split(' ')[0]} {screw.name.split(' ')[1]}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 功能 Tab 导航 */}
                <div className="grid grid-cols-4 gap-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs font-medium">
                    <button
                        onClick={() => setActiveTab('materials')}
                        className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${activeTab === 'materials' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <Package size={14} /> {t('配料与Mix料')}
                    </button>
                    <button
                        onClick={() => setActiveTab('adjustment')}
                        className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${activeTab === 'adjustment' ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <Wrench size={14} /> {t('位置调整')}
                    </button>
                    <button
                        onClick={() => setActiveTab('temperature')}
                        className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${activeTab === 'temperature' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <Thermometer size={14} /> {t('温度照片')}
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${activeTab === 'logs' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <History size={14} /> <span>{t('本机日志')} ({logs.length})</span>
                    </button>
                </div>

                {/* TAB 1: 螺杆配料清单与整页提交 */}
                {activeTab === 'materials' && (
                    <div className="space-y-4">

                        {/* 配料表头部：直接在此更改 Recipe */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                📦 {currentScrewConfig.name} 当前配方 ({currentMaterials.length} 项)
                            </span>

                            <button
                                onClick={() => setShowAddMatForm(true)}
                                className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition"
                            >
                                <PlusCircle size={14} /> ➕ 更改/增加物料
                            </button>
                        </div>

                        {/* 支持【下拉选择 + 直接打字输入】双重合一的输入框 */}
                        {showAddMatForm && (
                            <div className="bg-gray-950 p-3.5 border border-indigo-500/40 rounded-xl space-y-3 animate-fade-in shadow-xl">
                                <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                                    <span>添加物料到 [{currentScrewConfig.name}]：</span>
                                    <button onClick={() => setShowAddMatForm(false)} className="text-gray-400 hover:text-white">
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* 下拉 + 自由打字二合一输入框 */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 font-bold">物料名称 (点击可下拉选择，也可直接手动写字输入)：</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            list="raw-materials-datalist"
                                            value={newMatName}
                                            onChange={(e) => setNewMatName(e.target.value)}
                                            placeholder="下拉选择或打字输入 (如: LDPE 2426H)..."
                                            className="w-full bg-gray-900 border border-gray-700 text-xs px-3 py-2.5 rounded-lg text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                                        />
                                        <datalist id="raw-materials-datalist">
                                            {dbRawMaterials.map((matName, idx) => (
                                                <option key={idx} value={matName} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>

                                {/* 数量与单位 */}
                                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-gray-800">
                                    <div className="col-span-2 space-y-0.5">
                                        <label className="text-[10px] text-gray-400">数量</label>
                                        <input
                                            type="number"
                                            placeholder="数量"
                                            value={newMatQty}
                                            onChange={(e) => setNewMatQty(Number(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-800 text-xs px-2.5 py-1.5 rounded-lg text-white font-mono text-center font-bold"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-0.5">
                                        <label className="text-[10px] text-gray-400">单位 (1包=25kg)</label>
                                        <select
                                            value={newMatUnit}
                                            onChange={(e) => setNewMatUnit(e.target.value as any)}
                                            className="w-full bg-gray-900 border border-gray-800 text-xs px-2 py-1.5 rounded-lg text-amber-300 font-bold"
                                        >
                                            <option value="包">包 (25kg)</option>
                                            <option value="kg">kg</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleAddMaterial}
                                        className="col-span-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white font-extrabold text-xs rounded-lg shadow-lg transition mt-1"
                                    >
                                        确认添加
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 物料列表 */}
                        <div className="space-y-2">
                            {currentMaterials.length === 0 ? (
                                <div className="text-center py-6 bg-gray-950 border border-gray-800 rounded-xl text-gray-500 text-xs">
                                    此螺杆配方列表为空，点击 [➕ 更改/增加物料] 添加
                                </div>
                            ) : (
                                currentMaterials.map((mat) => {
                                    const isBags = mat.unit === '包';
                                    const calculatedKg = isBags ? mat.newQty * 25 : mat.newQty;

                                    return (
                                        <div key={mat.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-1.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2.5 flex-wrap">
                                                    {/* 📷 物料包装图片预览或【添加图片】按钮 */}
                                                    {mat.photoUrl ? (
                                                        <img
                                                            src={mat.photoUrl}
                                                            alt={mat.name}
                                                            onClick={() => setLightboxPhoto(mat.photoUrl || null)}
                                                            className="w-10 h-10 rounded-lg object-cover border border-indigo-500/50 shadow-md cursor-pointer hover:opacity-80 shrink-0"
                                                            title="点击放大预览物料包装图"
                                                        />
                                                    ) : (
                                                        <label className="text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer font-bold hover:bg-indigo-900/80 shrink-0 transition" title="上传/拍摄该物料外袋照片">
                                                            <Camera size={13} className="text-indigo-400" />
                                                            <span>📷 添加图片</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                capture="environment"
                                                                className="hidden"
                                                                onChange={(e) => handleItemPhotoUpload(mat.id, e)}
                                                            />
                                                        </label>
                                                    )}

                                                    <div>
                                                        <span className="font-extrabold text-white text-sm block">{mat.name}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {mat.photoUrl && (
                                                        <label className="text-[10px] text-gray-400 hover:text-indigo-300 underline cursor-pointer">
                                                            更换
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                capture="environment"
                                                                className="hidden"
                                                                onChange={(e) => handleItemPhotoUpload(mat.id, e)}
                                                            />
                                                        </label>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemoveMaterial(mat.id)}
                                                        className="text-gray-500 hover:text-rose-400 p-1 transition"
                                                        title="删除物料 (将记录删除审计日志)"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                {/* 数量调节加减 */}
                                                <div className="flex items-center space-x-1.5 bg-gray-900 p-1 rounded-lg border border-gray-800">
                                                    <button
                                                        onClick={() => handleUpdateQty(mat.id, mat.newQty - 1)}
                                                        className="px-2 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded font-bold text-xs"
                                                    >
                                                        -1
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={mat.newQty}
                                                        onChange={(e) => handleUpdateQty(mat.id, Number(e.target.value))}
                                                        className="w-12 text-center font-mono font-black text-amber-400 bg-transparent text-sm focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => handleToggleUnit(mat.id)}
                                                        className="text-[11px] bg-amber-950/60 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-bold hover:bg-amber-900/60"
                                                        title="点击切换单位 (包 / kg)"
                                                    >
                                                        {mat.unit} {isBags ? '(25kg/包)' : ''}
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateQty(mat.id, mat.newQty + 1)}
                                                        className="px-2 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded font-bold text-xs"
                                                    >
                                                        +1
                                                    </button>
                                                </div>

                                                {/* 重量计算提示 */}
                                                <div className="text-[11px] text-gray-400 font-mono">
                                                    = <span className="font-bold text-emerald-400">{calculatedKg}</span> kg
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* 📸 最下方：拍摄/上传操作员实际 Mix 料后的料斗实物照片凭证 */}
                        <div className="space-y-2 pt-3 border-t border-gray-800 mb-4">
                            <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Camera size={14} className="text-blue-400" />
                                    拍摄/上传【{currentScrewConfig.name}】Mix料实物或料斗照片 <span className="text-rose-400">*必填Mix凭证</span>
                                </span>
                                {currentHopperPhoto && <span className="text-emerald-400 text-[10px] font-bold">✓ 已上传照片凭证</span>}
                            </label>

                            <label className="border-2 border-dashed border-blue-500/40 bg-gray-950 hover:bg-gray-900 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer min-h-[95px] transition">
                                {currentHopperPhoto ? (
                                    <img src={currentHopperPhoto} alt="hopper-proof" className="w-full h-32 object-cover rounded-lg" />
                                ) : (
                                    <>
                                        <Camera size={22} className="text-blue-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-200">点击拍摄操作员 Mix 料完成后的料斗实物照片</span>
                                    </>
                                )}
                                <input
                                    ref={masterHopperPhotoInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleHopperPhotoUpload}
                                />
                            </label>
                        </div>

                        {/* 💾 粘性常显底部提交按钮 (Sticky Bottom submit bar) */}
                        <div className="sticky bottom-0 z-30 bg-gray-900/95 backdrop-blur-md p-3 border-t border-gray-800 space-y-1.5 shadow-2xl rounded-b-2xl">
                            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                                    <UserCheck size={12} />
                                    Mix料操作员: {currentUser?.name || currentUser?.email?.split('@')[0] || '现场操作员'}
                                </span>
                                <span>时间: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <button
                                onClick={handleSubmitFullScrewRecipe}
                                disabled={isSavingFullRecipe}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 text-white font-extrabold rounded-xl shadow-xl flex items-center justify-center space-x-2 text-sm transition active:scale-95 disabled:opacity-50"
                            >
                                {isSavingFullRecipe ? <Loader size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                <span>记录提交【{currentScrewConfig.name}】Mix料操作与照片</span>
                            </button>
                        </div>

                    </div>
                )}

                {/* TAB 2: 机器位置调整 */}
                {activeTab === 'adjustment' && (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-300">调整位置类型</label>
                            <select
                                value={adjPosition}
                                onChange={(e) => setAdjPosition(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white"
                            >
                                {PRESET_POSITIONS.map((pos, idx) => (
                                    <option key={idx} value={pos}>{pos}</option>
                                ))}
                            </select>
                        </div>

                        {adjPosition === '自定义位置 (Custom Location)' && (
                            <input
                                type="text"
                                value={adjCustomPos}
                                onChange={(e) => setAdjCustomPos(e.target.value)}
                                placeholder="输入具体调整位置..."
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-300">调整说明/刻度描述</label>
                            <input
                                type="text"
                                value={adjNotes}
                                onChange={(e) => setAdjNotes(e.target.value)}
                                placeholder="如：风环高度从 12cm 调至 15cm"
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                <Camera size={14} className="text-emerald-400" />
                                拍摄机器调整位置照片凭证 <span className="text-rose-400">*必填</span>
                            </label>

                            <label className="border-2 border-dashed border-emerald-500/40 bg-gray-950 hover:bg-gray-900 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer min-h-[110px]">
                                {adjPhotoUrl ? (
                                    <img src={adjPhotoUrl} alt="adj-proof" className="w-full h-32 object-cover rounded-lg" />
                                ) : (
                                    <>
                                        <Camera size={24} className="text-emerald-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-200">点击拍摄调整后的机器位置照片</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={async (e) => {
                                        if (e.target.files?.[0]) {
                                            const url = await compressImage(e.target.files[0], 1024, 0.7);
                                            setAdjPhotoUrl(url);
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        <button
                            onClick={handleSubmitAdjustment}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 text-sm"
                        >
                            <CheckCircle2 size={18} />
                            <span>保存机器位置调整记录</span>
                        </button>
                    </div>
                )}

                {/* TAB 3: 温度照片 */}
                {activeTab === 'temperature' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                            <div>
                                <label className="text-[11px] text-gray-400">1 区温度 (°C)</label>
                                <input
                                    type="number"
                                    value={tempZone1}
                                    onChange={(e) => setTempZone1(Number(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-400">2 区温度 (°C)</label>
                                <input
                                    type="number"
                                    value={tempZone2}
                                    onChange={(e) => setTempZone2(Number(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-400">3 区温度 (°C)</label>
                                <input
                                    type="number"
                                    value={tempZone3}
                                    onChange={(e) => setTempZone3(Number(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-amber-400 font-bold">模头温度 (°C)</label>
                                <input
                                    type="number"
                                    value={tempDieHead}
                                    onChange={(e) => setTempDieHead(Number(e.target.value))}
                                    className="w-full bg-amber-950/60 border border-amber-500/50 text-amber-300 font-mono font-extrabold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-300">温度状态评价</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { key: 'normal', label: '🟢 正常', class: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
                                    { key: 'overheat', label: '🔴 偏高/过热', class: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
                                    { key: 'too_low', label: '🔵 偏低/未达标', class: 'bg-blue-500/20 border-blue-500/40 text-blue-300' },
                                ].map((st) => (
                                    <button
                                        key={st.key}
                                        type="button"
                                        onClick={() => setTempStatus(st.key as any)}
                                        className={`p-2 rounded-xl border text-center text-xs font-bold transition ${tempStatus === st.key ? `${st.class} ring-2 ring-amber-500/50` : 'bg-gray-950 border-gray-800 text-gray-400'}`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                <Camera size={14} className="text-amber-400" />
                                拍摄温度控制面板/仪表照片 <span className="text-rose-400">*必填</span>
                            </label>

                            <label className="border-2 border-dashed border-amber-500/40 bg-gray-950 hover:bg-gray-900 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer min-h-[110px]">
                                {tempPhotoUrl ? (
                                    <img src={tempPhotoUrl} alt="temp-proof" className="w-full h-32 object-cover rounded-lg" />
                                ) : (
                                    <>
                                        <Camera size={24} className="text-amber-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-200">点击拍摄温度仪表控制面板</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={async (e) => {
                                        if (e.target.files?.[0]) {
                                            const url = await compressImage(e.target.files[0], 1024, 0.7);
                                            setTempPhotoUrl(url);
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        <button
                            onClick={handleSubmitTemperature}
                            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 text-sm"
                        >
                            <CheckCircle2 size={18} />
                            <span>确认保存温度快记与照片</span>
                        </button>
                    </div>
                )}

                {/* TAB 4: 本机日志 */}
                {activeTab === 'logs' && (
                    <div className="space-y-2.5">
                        {logs.length === 0 ? (
                            <div className="text-center py-8 bg-gray-950 border border-gray-800 rounded-xl text-gray-500 text-xs">
                                机台 [{machineName}] 暂无专属 Mix料 / 巡检记录
                            </div>
                        ) : (
                            logs.map((log, idx) => (
                                <div key={log.id || idx} className="bg-gray-950 border border-gray-800 rounded-xl p-3 flex items-center justify-between text-xs space-x-2">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="font-medium text-gray-200 flex items-center gap-2 flex-wrap">
                                            <span className="text-gray-300 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-[11px] font-normal shrink-0">
                                                {log.screw_name?.split(' ')[0] || log.screw_id || '螺杆 A'}
                                            </span>
                                            {log.log_type === 'material' && <span className="text-gray-100 truncate">{log.material_name}</span>}
                                            {log.log_type === 'machine_adjustment' && <span className="text-emerald-300">调整: {log.adjustment_position}</span>}
                                            {log.log_type === 'temperature' && <span className="text-amber-300">模头温度: {log.temp_die_head}°C</span>}
                                        </div>
                                        <div className="text-[11px] text-gray-400 flex items-center gap-3">
                                            <span className="text-gray-400 flex items-center gap-1">
                                                <UserCheck size={11} className="text-gray-500" /> 操作员: {log.operator_name}
                                            </span>
                                            <span>{new Date(log.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    {log.photo_url && (
                                        <img
                                            src={log.photo_url}
                                            alt="proof"
                                            onClick={() => setLightboxPhoto(log.photo_url)}
                                            className="w-10 h-10 rounded-lg object-cover border border-gray-800 cursor-pointer hover:opacity-80 shrink-0"
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

            </div>

            {/* LIGHTBOX */}
            {lightboxPhoto && (
                <div onClick={() => setLightboxPhoto(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer">
                    <img src={lightboxPhoto} alt="enlarged" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl border border-gray-800" />
                </div>
            )}
        </div>
    );
};

export default MachineInspectionModal;
