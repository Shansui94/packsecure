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
import {
    fetchGlobalMaterialPhotos,
    findMaterialStandardPhoto,
    saveGlobalMaterialPhoto,
    normalizeMaterialName
} from '../services/rawMaterialPhotoService';

interface MachineInspectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    machineId: string;
    machineName: string;
    currentUser?: User | null;
    activeFactoryId?: string;
}

type ScrewType = 'Screw_A' | 'Screw_B' | 'Screw_C';

// 稳健判断单位是否为 "包"（Bag / 25kg），跨中英马泰印多语言及旧数据兼容
export const isBagUnit = (u?: string | null): boolean => {
    if (!u) return false;
    const s = u.trim().toLowerCase();
    return s === 'bag' || s === '包' || s === '包包' || s === 'beg' || s.includes('bag') || s.includes('25kg') || s.includes('包');
};

interface MaterialItemState {
    id: string;
    name: string;
    sku: string;
    unit: string; // 1 包 = 25kg
    prevQty: number;
    newQty: number;
    photoUrl?: string; // 📷 物料包装外袋/实物照片
}

// 螺杆配置信息
const getScrewConfigs = (t: any): { id: ScrewType; name: string; tag: string; color: string }[] => [
    { id: 'Screw_A', name: t('Screw A'), tag: t('Outer layer/main screw'), color: 'from-rose-600 to-red-700' },
    { id: 'Screw_B', name: t('Screw B'), tag: t('Middle layer/auxiliary screw'), color: 'from-blue-600 to-cyan-700' },
    { id: 'Screw_C', name: t('Screw C'), tag: t('Inner layer (2m large machine)'), color: 'from-emerald-600 to-teal-700' },
];

// 工厂系统默认常用原材料预设库
const getMasterRawMaterialPresets = (t: any) => [
    'LDPE 2426H',
    'LDPE 6238',
    'HDPE / GC 7260',
    t('HDPE polyethylene material'),
    'C1802 / 7042',
    'L1220F / 1218WJ',
    '2192J / 18020SA / L1220F',
    t('Recycle (scrap/recycling)'),
    t('Black (black masterbatch)'),
    t('Plastic (transparent plastic material)'),
    t('White (white masterbatch)'),
    t('Anti-static (anti-static agent)'),
];

// 工厂现场手写纸初始预设（1包 = 25kg）
const getInitialPresetMaterials = (t: any): Record<ScrewType, MaterialItemState[]> => ({

    Screw_A: [
        { id: 'a1', name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', prevQty: 3, newQty: 3 },
        { id: 'a2', name: 'LDPE 6238', sku: 'RM-LDPE-6238', unit: 'bag', prevQty: 1, newQty: 1 },
        { id: 'a3', name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', prevQty: 5, newQty: 5 },
        { id: 'a4', name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', prevQty: 8, newQty: 8 },
        { id: 'a5', name: 'L1220F / 1218WJ', sku: 'RM-L1220F', unit: 'bag', prevQty: 5, newQty: 5 },
        { id: 'a6', name: t('Recycle (scrap/recycling)'), sku: 'RM-RECYCLE', unit: 'kg', prevQty: 10, newQty: 10 },
        { id: 'a7', name: t('Black (black masterbatch)'), sku: 'RM-MB-BLACK', unit: 'kg', prevQty: 16, newQty: 16 },
    ],
    Screw_B: [
        { id: 'b1', name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', prevQty: 3, newQty: 3 },
        { id: 'b2', name: t('HDPE polyethylene material'), sku: 'RM-HDPE-BASE', unit: 'bag', prevQty: 6, newQty: 6 },
        { id: 'b3', name: '2192J / 18020SA / L1220F', sku: 'RM-MIX-2192J', unit: 'bag', prevQty: 4, newQty: 4 },
        { id: 'b4', name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', prevQty: 11, newQty: 11 },
        { id: 'b5', name: t('Recycle (scrap/recycling)'), sku: 'RM-RECYCLE', unit: 'kg', prevQty: 20, newQty: 20 },
        { id: 'b6', name: t('Plastic (transparent plastic material)'), sku: 'RM-PLASTIC', unit: 'kg', prevQty: 10, newQty: 10 },
    ],
    Screw_C: [
        { id: 'c1', name: 'LDPE 2426H', sku: 'RM-LDPE-2426H', unit: 'bag', prevQty: 3, newQty: 3 },
        { id: 'c2', name: 'HDPE / GC 7260', sku: 'RM-HDPE-7260', unit: 'bag', prevQty: 5, newQty: 5 },
        { id: 'c3', name: 'C1802 / 7042', sku: 'RM-C1802', unit: 'bag', prevQty: 8, newQty: 8 },
        { id: 'c4', name: t('Recycle (scrap/recycling)'), sku: 'RM-RECYCLE', unit: 'kg', prevQty: 15, newQty: 15 },
    ]
});

// 预设机器调整位置
const getPresetPositions = (t: any) => [
    t('Air Ring Height'),
    t('Die Head Gap'),
    t('Traction knife position (Nip Roller / Cutter)'),
    t('Web Guide Sensor'),
    t('Air Shaft / Winder'),
    t('Custom Location')
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
    const [dbRawMaterials, setDbRawMaterials] = useState<string[]>(() => getMasterRawMaterialPresets(t));

    // 螺杆整组 Mix 料照片凭证
    const [screwHopperPhotos, setScrewHopperPhotos] = useState<Record<ScrewType, string>>({
        Screw_A: '',
        Screw_B: '',
        Screw_C: ''
    });

    // 各螺杆动态配方 State
    const [screwMaterials, setScrewMaterials] = useState<Record<ScrewType, MaterialItemState[]>>(() => getInitialPresetMaterials(t));

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
                    setScrewMaterials(getInitialPresetMaterials(t));
                }
            } catch (e) {
                console.error('Failed to load saved materials locally:', normKey, e);
                setScrewMaterials(getInitialPresetMaterials(t));
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
                employee_name: currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator'),
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
    const [newMatUnit, setNewMatUnit] = useState<string>('bag');

    // 提交保存状态
    const [isSavingFullRecipe, setIsSavingFullRecipe] = useState(false);

    // 机器调整表单
    const [adjPosition, setAdjPosition] = useState(() => getPresetPositions(t)[0]);
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

    // 全厂原材料标准包装图片映射库
    const [globalPhotoMap, setGlobalPhotoMap] = useState<Record<string, string>>({});

    // 初始加载数据库日志 & 原材料清单 & 全厂标准包装图片
    useEffect(() => {
        if (isOpen) {
            fetchMachineLogs();
            fetchDbRawMaterials();
            loadGlobalPhotos();
        }
    }, [isOpen, machineId, machineName]);

    const loadGlobalPhotos = async () => {
        try {
            const map = await fetchGlobalMaterialPhotos();
            setGlobalPhotoMap(map);
        } catch (e) {
            console.warn('Failed to load global material photos:', e);
        }
    };

    // 从 Supabase items 表（type = raw）拉取全厂原材料数据
    const fetchDbRawMaterials = async () => {
        try {
            const { data } = await supabase
                .from('items')
                .select('name')
                .eq('type', 'raw');

            if (data && data.length > 0) {
                const namesFromDb = data.map(i => i.name).filter(Boolean);
                const merged = Array.from(new Set([...namesFromDb, ...getMasterRawMaterialPresets(t)]));
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
                employee_name: currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator'),
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

    const currentScrewConfig = getScrewConfigs(t).find(s => s.id === selectedScrew) || getScrewConfigs(t)[0];
    const currentMaterials = screwMaterials[selectedScrew] || [];
    const currentHopperPhoto = screwHopperPhotos[selectedScrew];

    // ➕ 手动在上方增加物料
    const handleAddMaterial = async () => {
        const name = newMatName.trim();
        if (!name) {
            alert(t('Please select or type to enter the material name!'));
            return;
        }

        const newId = Date.now().toString();
        const defaultPhoto = findMaterialStandardPhoto(name, globalPhotoMap);
        const standardUnit = isBagUnit(newMatUnit) ? 'bag' : 'kg';
        const newItem: MaterialItemState = {
            id: newId,
            name: name,
            sku: `RM-${name.replace(/\s+/g, '-').toUpperCase()}`,
            unit: standardUnit,
            prevQty: newMatQty,
            newQty: newMatQty,
            photoUrl: defaultPhoto || undefined
        };

        const updatedMaterials = {
            ...screwMaterials,
            [selectedScrew]: [...(screwMaterials[selectedScrew] || []), newItem]
        };
        syncScrewMaterialsToCloud(updatedMaterials);

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator');

        // 写入 [更改配方 - 新增物料] 日志存库
        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: t('Add material: {{var0}} ({{var1}}{{var2}})', { var0: name, var1: newMatQty, var2: newMatUnit }),
            new_quantity: newMatQty,
            reaction_notes: t('Change recipe | Operator: {{var0}}', { var0: operatorName }),
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

            logActivity(currentUser, {
                action: 'ADD_MATERIAL_ITEM',
                module: 'MachineInspectionModal',
                target: `${machineName} (${selectedScrew}螺杆) - ${name}`,
                status: 'SUCCESS',
                resultSummary: `机台 ${machineName} 添加物料 [${name}]，用量: ${newMatQty} kg`,
                location: activeFactoryId,
                details: {
                    machine: machineName,
                    screw: selectedScrew,
                    material: name,
                    qty: newMatQty,
                    items: [{ name, qty: newMatQty, unit: 'kg', screw: selectedScrew }],
                    totalQuantity: newMatQty,
                    photos: currentHopperPhoto ? [currentHopperPhoto] : [],
                    photoUrl: currentHopperPhoto || null
                }
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
        const matName = targetMat ? targetMat.name : t('materials');

        const updatedMaterials = {
            ...screwMaterials,
            [selectedScrew]: (screwMaterials[selectedScrew] || []).filter(m => m.id !== id)
        };
        syncScrewMaterialsToCloud(updatedMaterials);

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator');

        // 写入 [更改配方 - 删除物料] 日志存库
        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: t('Delete material: {{var0}}', { var0: matName }),
            new_quantity: 0,
            reaction_notes: t('Change recipe | Operator: {{var0}}', { var0: operatorName }),
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

            logActivity(currentUser, {
                action: 'DELETE_MATERIAL_ITEM',
                module: 'MachineInspectionModal',
                target: `${machineName} (${selectedScrew}螺杆) - ${matName}`,
                status: 'SUCCESS',
                resultSummary: `机台 ${machineName} 删除物料 [${matName}]`,
                location: activeFactoryId,
                details: {
                    machine: machineName,
                    screw: selectedScrew,
                    material: matName,
                    photos: currentHopperPhoto ? [currentHopperPhoto] : [],
                    photoUrl: currentHopperPhoto || null
                }
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

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator');
        const delta = validQty - oldQty;

        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: t('Adjust quantity: {{var0}} ({{var1}} ➔ {{var2}} {{var3}})', { var0: targetMat.name, var1: oldQty, var2: validQty, var3: targetMat.unit }),
            previous_quantity: oldQty,
            new_quantity: validQty,
            change_amount: delta,
            reaction_notes: t('Change recipe quantity | Operator: {{var0}}', { var0: operatorName }),
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

            logActivity(currentUser, {
                action: 'UPDATE_MATERIAL_QTY',
                module: 'MachineInspectionModal',
                target: `${machineName} (${selectedScrew}螺杆) - ${targetMat.name}`,
                status: 'SUCCESS',
                resultSummary: `机台 ${machineName} 调整物料 [${targetMat.name}] 用量: ${oldQty} ➔ ${validQty} ${targetMat.unit || 'kg'}`,
                location: activeFactoryId,
                details: {
                    machine: machineName,
                    screw: selectedScrew,
                    material: targetMat.name,
                    oldQty: oldQty,
                    newQty: validQty,
                    items: [{ name: targetMat.name, oldQty, qty: validQty, unit: targetMat.unit || 'kg' }],
                    totalQuantity: validQty,
                    changes: { before: { qty: oldQty }, after: { qty: validQty } },
                    photos: currentHopperPhoto ? [currentHopperPhoto] : [],
                    photoUrl: currentHopperPhoto || null
                }
            });
        } catch (e) {
            console.error('Log update qty error:', e);
            saveLogToLocalAndState(newLog);
        }
    };

    // 🔁 手动切换单位（包 ⇋ kg）并智能换算数量，同时同步保存云端
    const handleToggleUnit = (id: string) => {
        const targetMat = currentMaterials.find(m => m.id === id);
        if (!targetMat) return;

        const currentlyBag = isBagUnit(targetMat.unit);
        let convertedQty = targetMat.newQty;
        let nextUnit: 'bag' | 'kg' = 'bag';

        if (currentlyBag) {
            // 包 ➔ kg：例如 3 包 ➔ 75 kg
            convertedQty = Math.round(targetMat.newQty * 25);
            nextUnit = 'kg';
        } else {
            // kg ➔ 包：例如 75 kg ➔ 3 包；非 25 整倍数保留 1 位小数
            const bags = targetMat.newQty / 25;
            convertedQty = Number.isInteger(bags) ? bags : Number(bags.toFixed(1));
            nextUnit = 'bag';
        }

        const updatedMaterials = {
            ...screwMaterials,
            [selectedScrew]: (screwMaterials[selectedScrew] || []).map(m => {
                if (m.id === id) {
                    return { ...m, unit: nextUnit, newQty: convertedQty, prevQty: targetMat.newQty };
                }
                return m;
            })
        };

        // 立即全端同步保存
        syncScrewMaterialsToCloud(updatedMaterials);
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

    // 📷 拍摄或上传单项物料包装/外袋照片（全厂防错标准包装袋照片建档与更新）
    const handleItemPhotoUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            const targetMat = currentMaterials.find(m => m.id === id);
            const matName = targetMat ? targetMat.name : '';
            const existingPhoto = targetMat?.photoUrl || findMaterialStandardPhoto(matName, globalPhotoMap);

            // 🛡️ 防误触二次确认：当全厂已有该材料标准照片时提示
            if (existingPhoto) {
                const confirmed = window.confirm(
                    `【全厂防错图库更新确认】\n\n原材料 [${matName || '此物料'}] 已有全厂标准包装图。\n更换后将同步更新全厂所有机台该物料的防错对照图。\n\n是否确认更换为新照片？`
                );
                if (!confirmed) {
                    e.target.value = '';
                    return;
                }
            }

            try {
                const compressed = await compressImage(file, 1024, 0.7);
                const cloudUrl = await uploadPhotoBlobToSupabase(compressed);
                
                // 1. 同步当前机台当前螺杆物料配方状态
                const updated = {
                    ...screwMaterials,
                    [selectedScrew]: (screwMaterials[selectedScrew] || []).map(m => m.id === id ? { ...m, photoUrl: cloudUrl } : m)
                };
                syncScrewMaterialsToCloud(updated);

                // 2. 沉淀至全厂统一原材料图库，所有机台和库存管理瞬间共享
                if (matName) {
                    await saveGlobalMaterialPhoto(matName, cloudUrl, currentUser);
                    setGlobalPhotoMap(prev => ({
                        ...prev,
                        [normalizeMaterialName(matName)]: cloudUrl
                    }));
                }
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
            alert(t('📸 Please take a photo/upload below [{{var0}}] the actual hopper or photo voucher after the Mix material is completed!', { var0: currentScrewConfig.name }));
            return;
        }

        setIsSavingFullRecipe(true);
        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator');
        const operatorIdStr = currentUser?.uid || localStorage.getItem('operatorId') || 'OP-UNKNOWN';

        const mixDetailsText = currentMaterials.map(m => `${m.name}: ${m.newQty}${m.unit}`).join(', ');

        const newLog: MobileInspectionLog = {
            log_type: 'material',
            machine_id: machineId,
            machine_name: machineName,
            screw_id: selectedScrew,
            screw_name: currentScrewConfig.name,
            material_name: t('Complete Mix recipe ({{var0}})', { var0: mixDetailsText }),
            new_quantity: currentMaterials.length,
            reaction_notes: t('Mix records | Operator: {{var0}} ({{var1}}) | Total {{var2}} items', { var0: operatorName, var1: operatorIdStr, var2: currentMaterials.length }),
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

            alert(t('✅ Successfully submitted and recorded [{{var0}}] Mix operation!\nMix Operator: {{var1}}\nActual Mix: {{var2}}', { var0: currentScrewConfig.name, var1: operatorName, var2: mixDetailsText }));
        } catch (e) {
            console.error('Submit mix record error:', e);
            saveLogToLocalAndState(newLog);
            alert(t('✅ [{{var0}}] Mix material record has been saved locally!', { var0: currentScrewConfig.name }));
        } finally {
            setIsSavingFullRecipe(false);
        }
    };

    // 提交位置调整
    const handleSubmitAdjustment = async () => {
        if (!adjPhotoUrl) {
            alert(t('📸 Please take photos of on-site proof of machine position adjustment!'));
            return;
        }

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator');
        const targetPos = adjPosition === t('Custom Location') ? adjCustomPos : adjPosition;

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

            alert(t('✅ The position adjustment of the machine [{{var0}}] has been successfully saved!', { var0: machineName }));
            setAdjPhotoUrl('');
            setAdjNotes('');
        } catch (e) {
            console.error(e);
            saveLogToLocalAndState(newLog);
            alert(t('✅ Machine [{{var0}}] position adjustment has been saved locally!', { var0: machineName }));
            setAdjPhotoUrl('');
            setAdjNotes('');
        }
    };

    // 提交温度
    const handleSubmitTemperature = async () => {
        if (!tempPhotoUrl) {
            alert(t('📸 Please take photos of the temperature control panel/instrument!'));
            return;
        }

        const operatorName = currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator');

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

            alert(t('✅ Machine [{{var0}}] ({{var1}}) temperature photo saved!', { var0: machineName, var1: currentScrewConfig.name }));
            setTempPhotoUrl('');
        } catch (e) {
            console.error(e);
            saveLogToLocalAndState(newLog);
            alert(t('✅ Machine [{{var0}}] ({{var1}}) temperature photo has been saved locally!', { var0: machineName, var1: currentScrewConfig.name }));
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
                        {getScrewConfigs(t).map((screw) => {
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
                            <div className="flex items-center gap-2.5">
                                <span className="text-xs font-bold text-gray-200 flex items-center gap-1">
                                    📦 {currentScrewConfig.name} <span className="text-gray-400">({currentMaterials.length} {t('item')})</span>
                                </span>
                                <span className="text-[11px] font-mono font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">
                                    {t('Total Batch')}: {currentMaterials.reduce((sum, mat) => sum + (isBagUnit(mat.unit) ? (Number(mat.newQty) || 0) * 25 : (Number(mat.newQty) || 0)), 0)} kg
                                </span>
                            </div>

                            <button
                                onClick={() => setShowAddMatForm(true)}
                                className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition"
                            >
                                <PlusCircle size={14} />  {t('➕ Change/add materials')}
                                                            </button>
                        </div>

                        {/* 支持【下拉选择 + 直接打字输入】双重合一的输入框 */}
                        {showAddMatForm && (
                            <div className="bg-gray-950 p-3.5 border border-indigo-500/40 rounded-xl space-y-3 animate-fade-in shadow-xl">
                                <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                                    <span>{t('Add items to [')}{currentScrewConfig.name}]：</span>
                                    <button onClick={() => setShowAddMatForm(false)} className="text-gray-400 hover:text-white">
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* 下拉 + 自由打字二合一输入框 */}
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 font-bold">{t('Material name (click to pull down the selection, or directly enter it manually):')}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            list="raw-materials-datalist"
                                            value={newMatName}
                                            onChange={(e) => setNewMatName(e.target.value)}
                                            placeholder={t('Drop down to select or type (eg: LDPE 2426H)...')}
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
                                        <label className="text-[10px] text-gray-400">{t('quantity')}</label>
                                        <input
                                            type="number"
                                            placeholder={t('quantity')}
                                            value={newMatQty}
                                            onChange={(e) => setNewMatQty(Number(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-800 text-xs px-2.5 py-1.5 rounded-lg text-white font-mono text-center font-bold"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-0.5">
                                        <label className="text-[10px] text-gray-400">{t('Unit (1 pack=25kg)')}</label>
                                        <select
                                            value={newMatUnit}
                                            onChange={(e) => setNewMatUnit(e.target.value as any)}
                                            className="w-full bg-gray-900 border border-gray-800 text-xs px-2 py-1.5 rounded-lg text-amber-300 font-bold"
                                        >
                                            <option value="bag">{t('Bag (25kg)')}</option>
                                            <option value="kg">kg</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleAddMaterial}
                                        className="col-span-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white font-extrabold text-xs rounded-lg shadow-lg transition mt-1"
                                    >
                                        
                                                                                {t('Confirm to add')}
                                                                            </button>
                                </div>
                            </div>
                        )}

                        {/* 物料列表 */}
                        <div className="space-y-2">
                            {currentMaterials.length === 0 ? (
                                <div className="text-center py-6 bg-gray-950 border border-gray-800 rounded-xl text-gray-500 text-xs">
                                    
                                                                        {t('This screw formula list is empty, click [➕ Change/Add Material] to add')}
                                                                    </div>
                            ) : (
                                currentMaterials.map((mat) => {
                                    const isBags = isBagUnit(mat.unit);
                                    const calculatedKg = isBags ? mat.newQty * 25 : mat.newQty;

                                    return (
                                        <div key={mat.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-1.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2.5 flex-wrap">
                                                    {/* 📷 物料包装图片预览（支持全厂标准防错图自动带出）或【添加图片】按钮 */}
                                                    {(() => {
                                                        const displayPhoto = mat.photoUrl || findMaterialStandardPhoto(mat.name, globalPhotoMap);
                                                        if (displayPhoto) {
                                                            return (
                                                                <div className="relative group shrink-0">
                                                                    <img
                                                                        src={displayPhoto}
                                                                        alt={mat.name}
                                                                        onClick={() => setLightboxPhoto(displayPhoto)}
                                                                        className="w-10 h-10 rounded-lg object-cover border-2 border-emerald-500/70 shadow-md cursor-pointer hover:opacity-80 transition"
                                                                        title={t('Standard packaging photo (Click to enlarge for verification)') || '标准外包装图（点击放大核对防错）'}
                                                                    />
                                                                    <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-[8px] font-black text-white px-1 rounded shadow-sm scale-90">
                                                                        {t('Standard') || '标准'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <label className="text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer font-bold hover:bg-indigo-900/80 shrink-0 transition" title={t('Upload/take photos of the outer bag of the material')}>
                                                                <Camera size={13} className="text-indigo-400" />
                                                                <span>{t('📷Add picture')}</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    capture="environment"
                                                                    className="hidden"
                                                                    onChange={(e) => handleItemPhotoUpload(mat.id, e)}
                                                                />
                                                            </label>
                                                        );
                                                    })()}

                                                    <div>
                                                        <span className="font-extrabold text-white text-sm block">{mat.name}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {(mat.photoUrl || findMaterialStandardPhoto(mat.name, globalPhotoMap)) && (
                                                        <label className="text-[10px] text-gray-400 hover:text-indigo-300 underline cursor-pointer">
                                                            
                                                                                                                        {t('replace')}
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
                                                        title={t('Delete material (record deletion in audit log)')}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                {/* 数量调节器与单位切换胶囊（排版优化，避免误触） */}
                                                <div className="flex items-center gap-2">
                                                    {/* 加减步进器：[-] [输入框] [+] 紧密排列 */}
                                                    <div className="flex items-center bg-gray-900 rounded-lg border border-gray-800 p-0.5 shadow-inner">
                                                        <button
                                                            onClick={() => handleUpdateQty(mat.id, Math.max(0, mat.newQty - 1))}
                                                            className="w-7 h-7 flex items-center justify-center bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded font-bold text-sm transition"
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
                                                            onClick={() => handleUpdateQty(mat.id, mat.newQty + 1)}
                                                            className="w-7 h-7 flex items-center justify-center bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded font-bold text-sm transition"
                                                        >
                                                            +1
                                                        </button>
                                                    </div>

                                                    {/* 独立单位切换胶囊，点击智能转换并同步 */}
                                                    <button
                                                        onClick={() => handleToggleUnit(mat.id)}
                                                        className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                                                            isBags
                                                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900/90 shadow-sm'
                                                                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 hover:bg-cyan-900/90 shadow-sm'
                                                        }`}
                                                        title={t('Click to convert unit (Bag ⇋ kg) with automatic quantity calculation') || '点击切换单位（包 ⇋ kg）自动换算数量'}
                                                    >
                                                        <span>{isBags ? t('Bag') : 'kg'}</span>
                                                        <span className="text-[10px] opacity-75 font-mono">{isBags ? '(25kg/包)' : '(公斤)'}</span>
                                                        <span className="text-[9px] opacity-60">⇄</span>
                                                    </button>
                                                </div>

                                                {/* 折合重量直观提示 */}
                                                <div className="text-xs font-mono text-gray-300 bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-800/80">
                                                    {isBags ? (
                                                        <>折合: <span className="font-black text-emerald-400 text-sm">{calculatedKg}</span> kg</>
                                                    ) : (
                                                        <><span className="font-black text-cyan-400 text-sm">{mat.newQty}</span> kg <span className="text-[10px] text-gray-400 font-normal">({(mat.newQty / 25).toFixed(1)}包)</span></>
                                                    )}
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
                                    
                                                                        {t('Shoot/Upload【')}{currentScrewConfig.name}{t('】Mix material or hopper photos')} <span className="text-rose-400">{t('*Mix credentials required')}</span>
                                </span>
                                {currentHopperPhoto && <span className="text-emerald-400 text-[10px] font-bold">{t('✓ Photo voucher uploaded')}</span>}
                            </label>

                            <label className="border-2 border-dashed border-blue-500/40 bg-gray-950 hover:bg-gray-900 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer min-h-[95px] transition">
                                {currentHopperPhoto ? (
                                    <img src={currentHopperPhoto} alt="hopper-proof" className="w-full h-32 object-cover rounded-lg" />
                                ) : (
                                    <>
                                        <Camera size={22} className="text-blue-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-200">{t('Click to take a photo of the actual hopper after the operator mixes the material')}</span>
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
                                    
                                                                        {t('Mix operator:')} {currentUser?.name || currentUser?.email?.split('@')[0] || t('field operator')}
                                </span>
                                <span>{t('time:')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <button
                                onClick={handleSubmitFullScrewRecipe}
                                disabled={isSavingFullRecipe}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 text-white font-extrabold rounded-xl shadow-xl flex items-center justify-center space-x-2 text-sm transition active:scale-95 disabled:opacity-50"
                            >
                                {isSavingFullRecipe ? <Loader size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                <span>{t('Record submission【')}{currentScrewConfig.name}{t('】Mix material operation and photos')}</span>
                            </button>
                        </div>

                    </div>
                )}

                {/* TAB 2: 机器位置调整 */}
                {activeTab === 'adjustment' && (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-300">{t('Adjust location type')}</label>
                            <select
                                value={adjPosition}
                                onChange={(e) => setAdjPosition(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-xs text-white"
                            >
                                {getPresetPositions(t).map((pos, idx) => (
                                    <option key={idx} value={pos}>{pos}</option>
                                ))}
                            </select>
                        </div>

                        {adjPosition === t('Custom Location') && (
                            <input
                                type="text"
                                value={adjCustomPos}
                                onChange={(e) => setAdjCustomPos(e.target.value)}
                                placeholder={t('Enter specific adjustment location...')}
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-300">{t('Adjustment Instructions/Scale Description')}</label>
                            <input
                                type="text"
                                value={adjNotes}
                                onChange={(e) => setAdjNotes(e.target.value)}
                                placeholder={t('For example: adjust the height of the wind ring from 12cm to 15cm')}
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                                <Camera size={14} className="text-emerald-400" />
                                
                                                                {t('Take photo evidence of machine adjustment position')} <span className="text-rose-400">{t('*Required')}</span>
                            </label>

                            <label className="border-2 border-dashed border-emerald-500/40 bg-gray-950 hover:bg-gray-900 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer min-h-[110px]">
                                {adjPhotoUrl ? (
                                    <img src={adjPhotoUrl} alt="adj-proof" className="w-full h-32 object-cover rounded-lg" />
                                ) : (
                                    <>
                                        <Camera size={24} className="text-emerald-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-200">{t('Click to take a photo of the adjusted machine position')}</span>
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
                            <span>{t('Save machine position adjustment records')}</span>
                        </button>
                    </div>
                )}

                {/* TAB 3: 温度照片 */}
                {activeTab === 'temperature' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                            <div>
                                <label className="text-[11px] text-gray-400">{t('Zone 1 temperature (°C)')}</label>
                                <input
                                    type="number"
                                    value={tempZone1}
                                    onChange={(e) => setTempZone1(Number(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-400">{t('Zone 2 Temperature (°C)')}</label>
                                <input
                                    type="number"
                                    value={tempZone2}
                                    onChange={(e) => setTempZone2(Number(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-gray-400">{t('Zone 3 temperature (°C)')}</label>
                                <input
                                    type="number"
                                    value={tempZone3}
                                    onChange={(e) => setTempZone3(Number(e.target.value))}
                                    className="w-full bg-gray-900 border border-gray-700 text-white font-mono font-bold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] text-amber-400 font-bold">{t('Die temperature (°C)')}</label>
                                <input
                                    type="number"
                                    value={tempDieHead}
                                    onChange={(e) => setTempDieHead(Number(e.target.value))}
                                    className="w-full bg-amber-950/60 border border-amber-500/50 text-amber-300 font-mono font-extrabold rounded-lg p-2 text-sm text-center"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-300">{t('Temperature status evaluation')}</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { key: 'normal', label: t('🟢 normal'), class: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
                                    { key: 'overheat', label: t('🔴 Too high/overheated'), class: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
                                    { key: 'too_low', label: t('🔵 Low/Not up to standard'), class: 'bg-blue-500/20 border-blue-500/40 text-blue-300' },
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
                                
                                                                {t('Take photos of the temperature control panel/gauge')} <span className="text-rose-400">{t('*Required')}</span>
                            </label>

                            <label className="border-2 border-dashed border-amber-500/40 bg-gray-950 hover:bg-gray-900 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer min-h-[110px]">
                                {tempPhotoUrl ? (
                                    <img src={tempPhotoUrl} alt="temp-proof" className="w-full h-32 object-cover rounded-lg" />
                                ) : (
                                    <>
                                        <Camera size={24} className="text-amber-400 mb-1" />
                                        <span className="text-xs font-bold text-gray-200">{t('Click to take a photo of the temperature gauge control panel')}</span>
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
                            <span>{t('Confirm to save temperature notes and photos')}</span>
                        </button>
                    </div>
                )}

                {/* TAB 4: 本机日志 */}
                {activeTab === 'logs' && (
                    <div className="space-y-2.5">
                        {logs.length === 0 ? (
                            <div className="text-center py-8 bg-gray-950 border border-gray-800 rounded-xl text-gray-500 text-xs">
                                
                                                                {t('machine [')}{machineName}{t('] No exclusive mix/inspection record yet')}
                                                            </div>
                        ) : (
                            logs.map((log, idx) => (
                                <div key={log.id || idx} className="bg-gray-950 border border-gray-800 rounded-xl p-3 flex items-center justify-between text-xs space-x-2">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="font-medium text-gray-200 flex items-center gap-2 flex-wrap">
                                            <span className="text-gray-300 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded text-[11px] font-normal shrink-0">
                                                {log.screw_name?.split(' ')[0] || log.screw_id || t('Screw A')}
                                            </span>
                                            {log.log_type === 'material' && <span className="text-gray-100 truncate">{log.material_name}</span>}
                                            {log.log_type === 'machine_adjustment' && <span className="text-emerald-300">{t('Adjustment:')} {log.adjustment_position}</span>}
                                            {log.log_type === 'temperature' && <span className="text-amber-300">{t('Die temperature:')} {log.temp_die_head}°C</span>}
                                        </div>
                                        <div className="text-[11px] text-gray-400 flex items-center gap-3">
                                            <span className="text-gray-400 flex items-center gap-1">
                                                <UserCheck size={11} className="text-gray-500" />  {t('Operator:')} {log.operator_name}
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
