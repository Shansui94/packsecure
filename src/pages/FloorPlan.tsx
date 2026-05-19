import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Image as KonvaImage } from 'react-konva';
import { Settings, ZoomIn, ZoomOut, Maximize, Plus, Save, Camera, MousePointer2, List, Map, Grid3X3, Loader2, Copy, ClipboardPaste, History, Lock, Upload } from 'lucide-react';
import { supabase } from '../services/supabase';
import type { User } from '../types';

function canEditFloorPlan(user?: User | null): boolean {
    if (!user) return false;
    if (user.role === 'SuperAdmin' || user.role === 'Admin') return true;
    if (user.roleModules?.includes('floor-plan-edit')) return true;
    return false;
}

// ----------------------------------------------------------------------------
// Type Definitions
// ----------------------------------------------------------------------------
interface FloorPlanArea {
    id: string;
    name: string;
    width_cm: number;  // Real world width in cm
    height_cm: number; // Real world height in cm
    bg_image_url?: string; // Optional background map
    shape?: 'rect' | 'polygon';
    points?: number[];
}

interface FloorItem {
    id: string;
    machine_id: string;
    type: 'machine' | 'wall' | 'obstacle' | 'conveyor' | 'safety_zone' | 'door' | 'text' | 'rack' | 'utility' | 'operator';
    shape: 'rect' | 'circle' | 'polygon';
    points?: number[]; // [x1, y1, x2, y2, ...]
    name: string;
    status: 'Running' | 'Idle' | 'Offline' | 'Alarm';
    x_cm: number;
    y_cm: number;
    width_cm: number;
    height_cm: number;
    rotation: number;
}

function cloneFloorItem(item: FloorItem, offsetCm = 50): FloorItem {
    return {
        ...item,
        id: `m${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        points: item.points ? [...item.points] : undefined,
        x_cm: item.x_cm + offsetCm,
        y_cm: item.y_cm + offsetCm,
    };
}

// ----------------------------------------------------------------------------
const BLACK_CROSSHAIR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M12 2v20M2 12h20' stroke='black' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`;

const COLORS: Record<string, string> = {
    Running: '#22c55e', // green-500
    Idle: '#eab308',    // yellow-500
    Offline: '#94a3b8', // slate-400
    Alarm: '#ef4444',   // red-500
};

interface FloorPlanProps {
    user?: User | null;
}

interface LayoutRevisionRow {
    id: string;
    zone_id: string;
    revision_number: number;
    snapshot: { floor: FloorPlanArea; items: FloorItem[] };
    created_at: string;
}

export default function FloorPlan({ user }: FloorPlanProps) {
    const canEditLayout = canEditFloorPlan(user);

    // State
    const [floors, setFloors] = useState<FloorPlanArea[]>([]);
    const [activeFloorId, setActiveFloorId] = useState<string>('');
    const [machinesData, setMachinesData] = useState<Record<string, FloorItem[]>>({});
    const [persistedZoneIds, setPersistedZoneIds] = useState<Set<string>>(new Set());
    const [persistedItemIds, setPersistedItemIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [revisionPanelOpen, setRevisionPanelOpen] = useState(false);
    const [revisions, setRevisions] = useState<LayoutRevisionRow[]>([]);
    const [revisionsLoading, setRevisionsLoading] = useState(false);
    const clipboardRef = useRef<FloorItem | null>(null);
    const pasteCountRef = useRef(0);
    const [hasClipboard, setHasClipboard] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [bgImageObj, setBgImageObj] = useState<HTMLImageElement | null>(null);
    const [hoveredData, setHoveredData] = useState<{item: FloorItem, x: number, y: number} | null>(null);
    
    // UI Toggles
    const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
    const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    // Canvas Stage State
    const [stageScale, setStageScale] = useState(0.4); // 0.4 means 40% zoom
    const [stagePosition, setStagePosition] = useState({ x: 50, y: 50 });
    const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
    const stageRef = useRef<any>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const activeFloor = floors.find(f => f.id === activeFloorId) || floors[0] || { id: 'dummy', name: 'Loading...', width_cm: 2000, height_cm: 1500 };
    const activeMachines = machinesData[activeFloorId] || [];
    const selectedMachine = activeMachines.find(m => m.id === selectedId);

    const markDirty = useCallback(() => setIsDirty(true), []);

    // Size Konva stage to the canvas container (not full window — avoids layout overflow)
    useEffect(() => {
        const el = canvasContainerRef.current;
        if (!el) return;
        const update = () => {
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (w > 0 && h > 0) setStageSize({ width: w, height: h });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener('resize', update);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [viewMode, isEditMode, activeFloorId]);

    useEffect(() => {
        if (!canEditLayout && isEditMode) {
            setIsEditMode(false);
            setSelectedId(null);
        }
    }, [canEditLayout, isEditMode]);

    // Fetch from Supabase
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const { data: zones, error: zErr } = await supabase.from('factory_zones').select('*');
                const { data: items, error: iErr } = await supabase.from('factory_zone_items').select('*');
                
                if (zErr) throw zErr;
                if (iErr) throw iErr;
                
                if (zones && zones.length > 0) {
                    setFloors(zones);
                    setActiveFloorId(zones[0].id);
                    setPersistedZoneIds(new Set(zones.map(z => z.id)));
                    
                    const grouped: Record<string, FloorItem[]> = {};
                    zones.forEach(z => grouped[z.id] = []);
                    if (items) {
                        items.forEach(i => {
                            if (!grouped[i.zone_id]) grouped[i.zone_id] = [];
                            grouped[i.zone_id].push(i as FloorItem);
                        });
                        setPersistedItemIds(new Set(items.map(i => i.id)));
                    } else {
                        setPersistedItemIds(new Set());
                    }
                    setMachinesData(grouped);
                } else {
                    // Fallback to default if DB is completely empty (first run)
                    const fId = 'f_' + Date.now();
                    const fallbackFloor: FloorPlanArea = { id: fId, name: 'Zone A (Main)', width_cm: 2000, height_cm: 1500, shape: 'rect' };
                    setFloors([fallbackFloor]);
                    setActiveFloorId(fId);
                    setMachinesData({ [fId]: [] });
                    setPersistedZoneIds(new Set());
                    setPersistedItemIds(new Set());
                }
                setIsDirty(false);
                clipboardRef.current = null;
                pasteCountRef.current = 0;
                setHasClipboard(false);
            } catch (e) {
                console.error("Error loading floor plan:", e);
            }
            setIsLoading(false);
        };
        loadData();

        // --------------------------------------------------------------------
        // LIVE IOT BINDING (Digital Twin Soul)
        // --------------------------------------------------------------------
        const pulseTimeouts: Record<string, NodeJS.Timeout> = {};

        const channel = supabase.channel('floor-plan-live-pulses')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_logs_v2' }, (payload) => {
                const newLog = payload.new;
                if (!newLog.machine_id) return;
                
                setMachinesData(prev => {
                    const next = { ...prev };
                    let updated = false;
                    for (const floorId in next) {
                        next[floorId] = next[floorId].map(m => {
                            if (m.machine_id === newLog.machine_id) {
                                updated = true;
                                
                                // Automatically revert to 'Idle' after 60 seconds of no pulses
                                if (pulseTimeouts[m.id]) clearTimeout(pulseTimeouts[m.id]);
                                pulseTimeouts[m.id] = setTimeout(() => {
                                    setMachinesData(curr => {
                                        const cNext = { ...curr };
                                        for (const fId in cNext) {
                                            cNext[fId] = cNext[fId].map(cm => cm.id === m.id ? { ...cm, status: 'Idle' } : cm);
                                        }
                                        return cNext;
                                    });
                                }, 60000);

                                return { ...m, status: 'Running' };
                            }
                            return m;
                        });
                    }
                    return updated ? next : prev;
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            Object.values(pulseTimeouts).forEach(clearTimeout);
        };
    }, []);

    const itemToRow = (m: FloorItem, floorId: string) => ({
        id: m.id,
        zone_id: floorId,
        machine_id: m.machine_id,
        type: m.type,
        shape: m.shape,
        points: m.points,
        name: m.name,
        status: m.status,
        x_cm: m.x_cm,
        y_cm: m.y_cm,
        width_cm: m.width_cm,
        height_cm: m.height_cm,
        rotation: m.rotation,
    });

    const handleSaveToDb = async () => {
        if (!canEditLayout) return;
        setIsSaving(true);
        try {
            const currentZoneIds = new Set(floors.map(f => f.id));
            const currentItemIds = new Set<string>();

            for (const f of floors) {
                const nextRevision = ((f as FloorPlanArea & { layout_revision?: number }).layout_revision ?? 0) + 1;
                const { error } = await supabase.from('factory_zones').upsert({
                    id: f.id,
                    name: f.name,
                    width_cm: f.width_cm,
                    height_cm: f.height_cm,
                    bg_image_url: f.bg_image_url,
                    shape: f.shape,
                    points: f.points,
                    layout_revision: nextRevision,
                });
                if (error) {
                    const { error: fallbackErr } = await supabase.from('factory_zones').upsert({
                        id: f.id,
                        name: f.name,
                        width_cm: f.width_cm,
                        height_cm: f.height_cm,
                        bg_image_url: f.bg_image_url,
                        shape: f.shape,
                        points: f.points,
                    });
                    if (fallbackErr) throw fallbackErr;
                } else {
                    (f as FloorPlanArea & { layout_revision?: number }).layout_revision = nextRevision;
                }

                const zoneItems = machinesData[f.id] || [];
                if (zoneItems.length > 0) {
                    const { error: itemsErr } = await supabase
                        .from('factory_zone_items')
                        .upsert(zoneItems.map(m => itemToRow(m, f.id)));
                    if (itemsErr) throw itemsErr;
                }
                zoneItems.forEach(m => currentItemIds.add(m.id));

                const snapshot = { floor: f, items: zoneItems };
                const revNum = (f as FloorPlanArea & { layout_revision?: number }).layout_revision ?? 1;
                const { error: revErr } = await supabase.from('factory_zone_layout_revisions').insert({
                    zone_id: f.id,
                    revision_number: revNum,
                    snapshot,
                    created_by: user?.uid ?? null,
                });
                if (revErr) {
                    console.warn('[FloorPlan] Revision history skipped (run scripts/db_ops/factory_zone_layout_revisions.sql):', revErr.message);
                }
            }

            for (const oldZoneId of persistedZoneIds) {
                if (!currentZoneIds.has(oldZoneId)) {
                    await supabase.from('factory_zone_items').delete().eq('zone_id', oldZoneId);
                    const { error: delZoneErr } = await supabase.from('factory_zones').delete().eq('id', oldZoneId);
                    if (delZoneErr) throw delZoneErr;
                }
            }

            for (const oldItemId of persistedItemIds) {
                if (!currentItemIds.has(oldItemId)) {
                    const { error: delItemErr } = await supabase.from('factory_zone_items').delete().eq('id', oldItemId);
                    if (delItemErr) throw delItemErr;
                }
            }

            setPersistedZoneIds(currentZoneIds);
            setPersistedItemIds(currentItemIds);
            setIsDirty(false);
            alert('Floor plan saved (incremental sync).');
        } catch (e) {
            console.error("Error saving floor plan:", e);
            alert('Failed to save. Check the browser console for details.');
        }
        setIsSaving(false);
    };

    const handlePublishLayout = async () => {
        if (!canEditLayout) return;
        if (isDirty) {
            alert('Save your changes before publishing the layout.');
            return;
        }
        setIsPublishing(true);
        try {
            for (const f of floors) {
                const rev = (f as FloorPlanArea & { layout_revision?: number }).layout_revision ?? 1;
                const { error } = await supabase
                    .from('factory_zones')
                    .update({ published_revision: rev })
                    .eq('id', f.id);
                if (error) {
                    console.warn('[FloorPlan] Publish skipped for zone', f.id, error.message);
                }
            }
            alert('Layout published. Read-only users will see the saved production version.');
        } catch (e) {
            console.error('Publish layout error:', e);
            alert('Publish failed. Run scripts/db_ops/factory_zone_layout_revisions.sql in Supabase if needed.');
        }
        setIsPublishing(false);
    };

    const loadRevisionsForActiveZone = async () => {
        if (!activeFloorId) return;
        setRevisionsLoading(true);
        const { data, error } = await supabase
            .from('factory_zone_layout_revisions')
            .select('id, zone_id, revision_number, snapshot, created_at')
            .eq('zone_id', activeFloorId)
            .order('revision_number', { ascending: false })
            .limit(20);
        if (error) {
            console.warn('[FloorPlan] Could not load revisions:', error.message);
            setRevisions([]);
        } else {
            setRevisions((data || []) as LayoutRevisionRow[]);
        }
        setRevisionsLoading(false);
    };

    const restoreRevision = (row: LayoutRevisionRow) => {
        if (!canEditLayout) return;
        if (!confirm(`Restore revision v${row.revision_number}? Unsaved edits will be lost.`)) return;
        const { floor, items } = row.snapshot;
        setFloors(prev => prev.map(f => (f.id === floor.id ? { ...f, ...floor } : f)));
        setMachinesData(prev => ({ ...prev, [floor.id]: items.map(i => ({ ...i, points: i.points ? [...i.points] : undefined })) }));
        if (activeFloorId === floor.id) setSelectedId(null);
        markDirty();
        setRevisionPanelOpen(false);
    };

    const pasteClipboard = useCallback(() => {
        const source = clipboardRef.current;
        if (!source || !isEditMode) return;
        pasteCountRef.current += 1;
        const offset = 50 * pasteCountRef.current;
        const pasted = cloneFloorItem(source, offset);
        setMachinesData(p => ({ ...p, [activeFloorId]: [...(p[activeFloorId] || []), pasted] }));
        setSelectedId(pasted.id);
        markDirty();
    }, [activeFloorId, isEditMode, markDirty]);

    // Load Background Image
    useEffect(() => {
        if (activeFloor.bg_image_url) {
            const img = new window.Image();
            img.src = activeFloor.bg_image_url;
            img.onload = () => setBgImageObj(img);
            img.onerror = () => setBgImageObj(null);
        } else {
            setBgImageObj(null);
        }
    }, [activeFloor.bg_image_url]);

    // Helper: Calculate Polygon Area (m²) using Shoelace Formula
    const calculateArea = (pts: number[] | undefined) => {
        if (!pts || pts.length < 6) return 0;
        let area = 0;
        for (let i = 0; i < pts.length; i += 2) {
            const x1 = pts[i];
            const y1 = pts[i + 1];
            const x2 = pts[(i + 2) % pts.length];
            const y2 = pts[(i + 3) % pts.length];
            area += x1 * y2 - x2 * y1;
        }
        return Math.abs(area / 2) / 10000; // Convert cm² to m²
    };

    // Helper: Render CAD-like edge dimensions for polygons
    const renderEdgeDimensions = (pts: number[] | undefined, isClosed: boolean, color: string = "#2563eb") => {
        if (!pts || pts.length < 4) return null;
        const labels = [];
        for (let i = 0; i < pts.length; i += 2) {
            const x1 = pts[i];
            const y1 = pts[i + 1];
            if (!isClosed && i === pts.length - 2) break;
            
            const nextX = isClosed ? pts[(i + 2) % pts.length] : pts[i + 2];
            const nextY = isClosed ? pts[(i + 3) % pts.length] : pts[i + 3];
            
            if (nextX === undefined || nextY === undefined) continue;

            const dx = nextX - x1;
            const dy = nextY - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length < 20) continue;

            const midX = (x1 + nextX) / 2;
            const midY = (y1 + nextY) / 2;
            
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angle > 90 || angle < -90) {
                angle += 180;
            }

            labels.push(
                <Text
                    key={`dim_${i}`}
                    x={midX}
                    y={midY}
                    text={`${Math.round(length)} cm`}
                    fontSize={40}
                    fill={color}
                    fontStyle="bold"
                    align="center"
                    width={400}
                    offsetX={200}
                    offsetY={35}
                    rotation={angle}
                    shadowColor="white"
                    shadowBlur={4}
                    shadowOpacity={1}
                    listening={false}
                />
            );
        }
        return labels;
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            if (e.code === 'Space') {
                e.preventDefault();
                setIsSpacePressed(true);
                return;
            }

            if (!isEditMode) return;

            const selectedMachine = selectedId ? machinesData[activeFloorId]?.find(m => m.id === selectedId) : undefined;

            if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
                removeMachine(selectedId);
                return;
            }

            if (selectedMachine && (e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                clipboardRef.current = {
                    ...selectedMachine,
                    points: selectedMachine.points ? [...selectedMachine.points] : undefined,
                };
                pasteCountRef.current = 0;
                setHasClipboard(true);
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                if (clipboardRef.current) pasteClipboard();
                return;
            }

            if (!selectedMachine) return;

            if (e.key === 'ArrowUp') { e.preventDefault(); updateMachine(selectedId!, { y_cm: selectedMachine.y_cm - (gridSnapEnabled ? 10 : 1) }); }
            if (e.key === 'ArrowDown') { e.preventDefault(); updateMachine(selectedId!, { y_cm: selectedMachine.y_cm + (gridSnapEnabled ? 10 : 1) }); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); updateMachine(selectedId!, { x_cm: selectedMachine.x_cm - (gridSnapEnabled ? 10 : 1) }); }
            if (e.key === 'ArrowRight') { e.preventDefault(); updateMachine(selectedId!, { x_cm: selectedMachine.x_cm + (gridSnapEnabled ? 10 : 1) }); }

            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                const clone = cloneFloorItem(selectedMachine, 50);
                setMachinesData(p => ({ ...p, [activeFloorId]: [...(p[activeFloorId] || []), clone] }));
                setSelectedId(clone.id);
                markDirty();
            }

            // Z-Index Adjustments ([ and ])
            if (e.key === '[' || e.key === ']') {
                e.preventDefault();
                const arr = [...(machinesData[activeFloorId] || [])];
                const idx = arr.findIndex(m => m.id === selectedId);
                if (idx !== -1) {
                    if (e.key === '[' && idx > 0) {
                        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                        setMachinesData(p => ({ ...p, [activeFloorId]: arr }));
                    } else if (e.key === ']' && idx < arr.length - 1) {
                        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                        setMachinesData(p => ({ ...p, [activeFloorId]: arr }));
                    }
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacePressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { 
            window.removeEventListener('keydown', handleKeyDown); 
            window.removeEventListener('keyup', handleKeyUp); 
        };
    }, [isEditMode, selectedId, activeFloorId, machinesData, gridSnapEnabled, pasteClipboard, markDirty]);

    const handleExport = () => {
        if (!stageRef.current) return;
        const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `${activeFloor.name}_layout.png`;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ------------------------------------------------------------------------
    // Stage Interactions (Zoom / Pan)
    // ------------------------------------------------------------------------
    const handleWheel = (e: any) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        
        // Trackpad pinch-to-zoom OR Ctrl + Scroll
        if (e.evt.ctrlKey || e.evt.metaKey) {
            const scaleBy = 1.05;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            if (!pointer) return;

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            // Use direction because deltaY scale can vary wildly on trackpads
            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
            
            if (newScale < 0.05 || newScale > 3) return;

            setStageScale(newScale);
            setStagePosition({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            });
        } else {
            // Trackpad two-finger pan OR normal mouse scroll (pans vertically/horizontally)
            setStagePosition(prev => ({
                x: prev.x - e.evt.deltaX,
                y: prev.y - e.evt.deltaY
            }));
        }
    };

    const resetZoom = () => {
        setStageScale(0.4);
        setStagePosition({ x: 50, y: 50 });
    };

    // ------------------------------------------------------------------------
    // Machine Interactions
    // ------------------------------------------------------------------------
    const handleDragEnd = (e: any, id: string) => {
        if (!isEditMode) return;
        
        const snap = gridSnapEnabled ? 10 : 1;
        const rawX = e.target.x();
        const rawY = e.target.y();
        const snappedX = Math.round(rawX / snap) * snap;
        const snappedY = Math.round(rawY / snap) * snap;

        updateMachine(id, { x_cm: snappedX, y_cm: snappedY });
        markDirty();
    };

    const updateMachine = (id: string, updates: Partial<FloorItem>) => {
        markDirty();
        setMachinesData(prev => ({
            ...prev,
            [activeFloorId]: prev[activeFloorId].map(mac => {
                if (mac.id === id) {
                    const newMac = { ...mac, ...updates };
                    if (updates.shape === 'polygon' && !mac.points) {
                        newMac.points = [0, 0, mac.width_cm, 0, mac.width_cm, mac.height_cm, 0, mac.height_cm];
                    }
                    return newMac;
                }
                return mac;
            })
        }));
    };

    const handlePointDrag = (id: string, index: number, newX: number, newY: number) => {
        markDirty();
        setMachinesData(prev => ({
            ...prev,
            [activeFloorId]: prev[activeFloorId].map(mac => {
                if (mac.id === id && mac.points) {
                    const newPts = [...mac.points];
                    newPts[index] = newX;
                    newPts[index + 1] = newY;
                    return { ...mac, points: newPts };
                }
                return mac;
            })
        }));
    };

    const addPolygonNode = (id: string) => {
        markDirty();
        setMachinesData(prev => ({
            ...prev,
            [activeFloorId]: prev[activeFloorId].map(mac => {
                if (mac.id === id && mac.points && mac.points.length >= 2) {
                    const pts = mac.points;
                    const lastX = pts[pts.length - 2];
                    const lastY = pts[pts.length - 1];
                    return { ...mac, points: [...pts, lastX + 50, lastY + 50] };
                }
                return mac;
            })
        }));
    };

    const removePolygonNode = (id: string) => {
        markDirty();
        setMachinesData(prev => ({
            ...prev,
            [activeFloorId]: prev[activeFloorId].map(mac => {
                if (mac.id === id && mac.points && mac.points.length > 6) { // min 3 points (6 coords)
                    return { ...mac, points: mac.points.slice(0, -2) };
                }
                return mac;
            })
        }));
    };

    const handleAddFloor = () => {
        const newId = 'f' + Date.now();
        const newFloor: FloorPlanArea = {
            id: newId,
            name: 'New Zone',
            width_cm: 1000,
            height_cm: 1000
        };
        setFloors([...floors, newFloor]);
        setMachinesData(prev => ({ ...prev, [newId]: [] }));
        setActiveFloorId(newId);
        setSelectedId(null);
        resetZoom();
        markDirty();
    };

    const handleAddMachine = () => {
        const newId = 'm' + Date.now();
        const newMachine: FloorItem = {
            id: newId,
            machine_id: `M-${Math.floor(Math.random() * 1000)}`,
            type: 'machine',
            shape: 'rect',
            name: 'New Item',
            status: 'Offline',
            x_cm: activeFloor.width_cm / 2 - 50,
            y_cm: activeFloor.height_cm / 2 - 50,
            width_cm: 100,
            height_cm: 100,
            rotation: 0
        };
        setMachinesData(prev => ({
            ...prev,
            [activeFloorId]: [...(prev[activeFloorId] || []), newMachine]
        }));
        setSelectedId(newId);
        markDirty();
    };

    const updateFloor = (updates: Partial<FloorPlanArea>) => {
        markDirty();
        setFloors(prev => prev.map(f => f.id === activeFloorId ? { ...f, ...updates } : f));
    };

    const updateFloorShape = (shape: 'rect' | 'polygon') => {
        markDirty();
        setFloors(prev => prev.map(f => {
            if (f.id === activeFloorId) {
                const newF = { ...f, shape };
                if (shape === 'polygon' && !f.points) {
                    newF.points = [0, 0, f.width_cm, 0, f.width_cm, f.height_cm, 0, f.height_cm];
                }
                return newF;
            }
            return f;
        }));
    };

    const handleFloorPointDrag = (index: number, newX: number, newY: number) => {
        markDirty();
        setFloors(prev => prev.map(f => {
            if (f.id === activeFloorId && f.points) {
                const newPts = [...f.points];
                newPts[index] = newX;
                newPts[index + 1] = newY;
                return { ...f, points: newPts };
            }
            return f;
        }));
    };

    const addFloorPolygonNode = () => {
        markDirty();
        setFloors(prev => prev.map(f => {
            if (f.id === activeFloorId && f.points && f.points.length >= 2) {
                const pts = f.points;
                return { ...f, points: [...pts, pts[pts.length - 2] + 200, pts[pts.length - 1] + 200] };
            }
            return f;
        }));
    };

    const removeFloorPolygonNode = () => {
        markDirty();
        setFloors(prev => prev.map(f => {
            if (f.id === activeFloorId && f.points && f.points.length > 6) {
                return { ...f, points: f.points.slice(0, -2) };
            }
            return f;
        }));
    };

    const removeMachine = (id: string) => {
        markDirty();
        setMachinesData(prev => ({
            ...prev,
            [activeFloorId]: prev[activeFloorId].filter(m => m.id !== id)
        }));
        setSelectedId(null);
    };

    const toggleEditMode = () => {
        if (isEditMode && isDirty) {
            if (!confirm('You have unsaved changes. Exit edit mode anyway?')) return;
        }
        setIsEditMode(!isEditMode);
        setSelectedId(null);
        setHoveredData(null);
    };

    // ------------------------------------------------------------------------
    // Render Functions
    // ------------------------------------------------------------------------
    
    // Draw grid lines every 100cm (1 meter)
    const renderGrid = () => {
        const lines = [];
        const step = 100; // 1m
        const w = activeFloor.width_cm;
        const h = activeFloor.height_cm;

        for (let i = 0; i <= w; i += step) {
            lines.push(<Line key={`v${i}`} points={[i, 0, i, h]} stroke="#e2e8f0" strokeWidth={1} />);
            if (i % 500 === 0 && i > 0) { // Highlight every 5m
                lines.push(<Line key={`v_major${i}`} points={[i, 0, i, h]} stroke="#cbd5e1" strokeWidth={2} />);
                lines.push(<Text key={`tv${i}`} x={i + 5} y={5} text={`${i/100}m`} fontSize={14} fill="#94a3b8" />);
            }
        }
        for (let i = 0; i <= h; i += step) {
            lines.push(<Line key={`h${i}`} points={[0, i, w, i]} stroke="#e2e8f0" strokeWidth={1} />);
            if (i % 500 === 0 && i > 0) {
                lines.push(<Line key={`h_major${i}`} points={[0, i, w, i]} stroke="#cbd5e1" strokeWidth={2} />);
                lines.push(<Text key={`th${i}`} x={5} y={i + 5} text={`${i/100}m`} fontSize={14} fill="#94a3b8" />);
            }
        }
        return lines;
    };

    return (
        <div className="p-4 md:p-6 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex flex-col bg-slate-50 overflow-hidden">
            {/* Top Bar: Floor Selection & Global Actions */}
            <div className="shrink-0 flex flex-col gap-3 mb-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Space Management</h1>
                        <p className="text-sm text-slate-500">Precise floor layout & live monitoring</p>
                    </div>
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>
                    {/* Floor Plan Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-lg items-center">
                        {floors.map(floor => (
                            <button
                                key={floor.id}
                                onClick={() => { setActiveFloorId(floor.id); setSelectedId(null); }}
                                className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                                    activeFloorId === floor.id 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {floor.name}
                            </button>
                        ))}
                        {isEditMode && canEditLayout && (
                            <button 
                                onClick={handleAddFloor}
                                className="ml-2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                                title="Add New Zone"
                            >
                                <Plus size={18} />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-end">
                    <button 
                        onClick={() => setViewMode(v => v === 'map' ? 'table' : 'map')}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors border border-indigo-200"
                        title="Toggle Table View"
                    >
                        {viewMode === 'map' ? <><List size={18} /> Table View</> : <><Map size={18} /> Map View</>}
                    </button>
                    <button 
                        onClick={handleExport}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-colors"
                        title="Export as PNG"
                    >
                        <Camera size={18} /> Export
                    </button>
                    {canEditLayout ? (
                        <>
                            <button 
                                onClick={toggleEditMode}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                    isEditMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                <Settings size={18} />
                                {isEditMode ? 'Exit Setup' : 'Setup Floor'}
                            </button>
                            {isEditMode && (
                                <>
                                    <button
                                        onClick={() => {
                                            if (!selectedMachine) return;
                                            clipboardRef.current = {
                                                ...selectedMachine,
                                                points: selectedMachine.points ? [...selectedMachine.points] : undefined,
                                            };
                                            pasteCountRef.current = 0;
                                            setHasClipboard(true);
                                        }}
                                        disabled={!selectedMachine}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center gap-2 disabled:opacity-40"
                                        title="Ctrl+C"
                                    >
                                        <Copy size={18} /> Copy
                                    </button>
                                    <button
                                        onClick={pasteClipboard}
                                        disabled={!hasClipboard}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium flex items-center gap-2 disabled:opacity-40"
                                        title="Ctrl+V"
                                    >
                                        <ClipboardPaste size={18} /> Paste
                                    </button>
                                    <button
                                        onClick={() => { setRevisionPanelOpen(true); loadRevisionsForActiveZone(); }}
                                        className="px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg font-medium flex items-center gap-2"
                                    >
                                        <History size={18} /> History
                                    </button>
                                    <button 
                                        onClick={handleSaveToDb}
                                        disabled={isSaving || !isDirty}
                                        className={`px-4 py-2 text-white rounded-lg font-medium shadow-sm flex items-center gap-2 ${isSaving || !isDirty ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={handlePublishLayout}
                                        disabled={isPublishing || isDirty}
                                        className={`px-4 py-2 rounded-lg font-medium shadow-sm flex items-center gap-2 text-white ${isPublishing || isDirty ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                        title="Mark the current saved layout as the published version"
                                    >
                                        {isPublishing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                        Publish
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <span className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium flex items-center gap-2 border border-slate-200">
                            <Lock size={16} /> Read-only
                        </span>
                    )}
                </div>
                </div>
            </div>

            {!canEditLayout && (
                <div className="shrink-0 mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-center gap-2">
                    <Lock size={16} />
                    Read-only mode. Admins can edit; grant module permission floor-plan-edit for others.
                </div>
            )}
            {canEditLayout && isDirty && (
                <div className="shrink-0 mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    Unsaved changes — Save first, then Publish.
                </div>
            )}

            <div className="flex flex-1 min-h-0 gap-4 overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 z-50 bg-slate-50/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
                        <p className="text-slate-600 font-medium">Loading Floor Plan from Supabase...</p>
                    </div>
                )}
                
                {/* Global Dashboard HUD (Only in Live View) */}
                {!isEditMode && (
                    <div className="absolute top-4 left-4 z-10 w-64 bg-slate-900/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-slate-700 pointer-events-none">
                        <h3 className="text-white font-bold text-sm mb-3">Live Production HUD</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs text-slate-300">
                                <span>Running</span>
                                <span className="font-bold text-green-400">{activeMachines.filter(m => m.type === 'machine' && m.status === 'Running').length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-300">
                                <span>Idle</span>
                                <span className="font-bold text-yellow-400">{activeMachines.filter(m => m.type === 'machine' && m.status === 'Idle').length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-300">
                                <span>Alarms</span>
                                <span className="font-bold text-red-400">{activeMachines.filter(m => m.type === 'machine' && m.status === 'Alarm').length}</span>
                            </div>
                            <div className="h-px bg-slate-700 my-2"></div>
                            <div className="flex justify-between items-center text-sm font-black text-white">
                                <span>Efficiency</span>
                                <span className="text-blue-400">
                                    {activeMachines.filter(m => m.type === 'machine').length > 0 
                                        ? Math.round((activeMachines.filter(m => m.type === 'machine' && m.status === 'Running').length / activeMachines.filter(m => m.type === 'machine').length) * 100) 
                                        : 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Glassmorphic Hover Tooltip */}
                {hoveredData && !isEditMode && (
                    <div 
                        className="fixed z-50 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-white pointer-events-none transition-all duration-75"
                        style={{ left: hoveredData.x + 15, top: hoveredData.y + 15, width: 220 }}
                    >
                        <h4 className="font-bold text-slate-800 text-sm">{hoveredData.item.name}</h4>
                        <div className="mt-2 space-y-1">
                            <p className="text-xs text-slate-500 flex justify-between">
                                <span>Status:</span>
                                <span className="font-semibold" style={{ color: COLORS[hoveredData.item.status] }}>{hoveredData.item.status}</span>
                            </p>
                            <p className="text-xs text-slate-500 flex justify-between"><span>Machine ID:</span> <span className="font-mono">{hoveredData.item.machine_id}</span></p>
                        </div>
                    </div>
                )}

                {/* Main Canvas Area */}
                <div className="flex-1 min-h-0 min-w-0 bg-slate-100 rounded-xl shadow-inner border border-slate-300 overflow-hidden relative flex flex-col">
                    {viewMode === 'table' ? (
                        <div className="flex-1 overflow-auto p-6 bg-white">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">{activeFloor.name} - Asset Inventory</h2>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 text-sm">
                                        <th className="p-3 border-b border-slate-200 font-semibold rounded-tl-lg">Type</th>
                                        <th className="p-3 border-b border-slate-200 font-semibold">Name</th>
                                        <th className="p-3 border-b border-slate-200 font-semibold">Machine ID</th>
                                        <th className="p-3 border-b border-slate-200 font-semibold">Status</th>
                                        <th className="p-3 border-b border-slate-200 font-semibold">Coordinates (cm)</th>
                                        <th className="p-3 border-b border-slate-200 font-semibold rounded-tr-lg">Dimensions (cm)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeMachines.map(m => (
                                        <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="p-3 text-sm capitalize">{m.type.replace('_', ' ')}</td>
                                            <td className="p-3 text-sm font-medium text-slate-800">{m.name || '-'}</td>
                                            <td className="p-3 text-sm font-mono text-slate-500">{m.machine_id || '-'}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-1 text-xs rounded-full font-medium" style={{ backgroundColor: `${COLORS[m.status]}20`, color: COLORS[m.status] }}>
                                                    {m.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm font-mono text-slate-500">X:{m.x_cm}, Y:{m.y_cm}</td>
                                            <td className="p-3 text-sm text-slate-500">{m.width_cm} × {m.height_cm}</td>
                                        </tr>
                                    ))}
                                    {activeMachines.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No objects found in this zone.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <>
                            {/* Zoom Controls Overlay */}
                            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/90 p-2 rounded-lg shadow-md border border-slate-200 backdrop-blur">
                                <button onClick={() => setStageScale(s => Math.min(s * 1.2, 3))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomIn size={20}/></button>
                                <button onClick={resetZoom} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Maximize size={20}/></button>
                                <button onClick={() => setStageScale(s => Math.max(s / 1.2, 0.05))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomOut size={20}/></button>
                                {isEditMode && (
                                    <button 
                                        onClick={() => setGridSnapEnabled(!gridSnapEnabled)}
                                        className={`p-2 hover:bg-slate-100 rounded transition-colors flex justify-center items-center ${gridSnapEnabled ? 'text-blue-600' : 'text-slate-400'}`}
                                        title={gridSnapEnabled ? "Disable Grid Snap" : "Enable Grid Snap"}
                                    >
                                        <Grid3X3 size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Canvas */}
                            <div
                                ref={canvasContainerRef}
                                className="flex-1 min-h-0 w-full relative"
                                id="canvas-container"
                                style={{ cursor: isSpacePressed ? 'grab' : (isEditMode ? BLACK_CROSSHAIR : 'grab') }}
                            >
                                <Stage 
                                    ref={stageRef}
                                    width={stageSize.width}
                                    height={stageSize.height}
                                    scaleX={stageScale}
                                    scaleY={stageScale}
                                    x={stagePosition.x}
                                    y={stagePosition.y}
                                    onWheel={handleWheel}
                                    draggable={!isEditMode || isSpacePressed}
                                    onDragEnd={(e) => {
                                        if (e.target === e.target.getStage()) {
                                            setStagePosition({ x: e.target.x(), y: e.target.y() });
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        if (e.target === e.target.getStage() && !isSpacePressed) {
                                            setSelectedId(null);
                                        }
                                    }}
                                >
                            <Layer>
                                {/* Custom Background Image (Rendered under the floor) */}
                                {bgImageObj && (
                                    <KonvaImage
                                        image={bgImageObj}
                                        width={activeFloor.width_cm}
                                        height={activeFloor.height_cm}
                                        opacity={isEditMode ? 0.5 : 0.8} // Dim slightly in edit mode
                                    />
                                )}

                                {/* Floor Boundary Background */}
                                {activeFloor.shape === 'polygon' ? (
                                    <Line
                                        points={activeFloor.points || [0, 0, activeFloor.width_cm, 0, activeFloor.width_cm, activeFloor.height_cm, 0, activeFloor.height_cm]}
                                        closed
                                        fill="white"
                                        stroke="#cbd5e1"
                                        strokeWidth={4}
                                        shadowColor="black"
                                        shadowBlur={20}
                                        shadowOpacity={0.1}
                                        opacity={bgImageObj ? 0.8 : 1} // make floor semi transparent if there's a reference image
                                    />
                                ) : (
                                    <Rect
                                        width={activeFloor.width_cm}
                                        height={activeFloor.height_cm}
                                        fill="white"
                                        stroke="#cbd5e1"
                                        strokeWidth={4}
                                        shadowColor="black"
                                        shadowBlur={20}
                                        shadowOpacity={0.1}
                                        opacity={bgImageObj ? 0.8 : 1}
                                    />
                                )}
                                
                                {/* Render Floor Dimensions & Drag Nodes */}
                                {(!selectedMachine && activeFloor.shape === 'polygon' && activeFloor.points) && (
                                    <Group>
                                        {renderEdgeDimensions(activeFloor.points, true, "#f59e0b")}
                                        {isEditMode && activeFloor.points.map((_, i) => {
                                        if (i % 2 !== 0) return null;
                                        return (
                                            <Circle
                                                key={`floor_pt_${i}`}
                                                x={activeFloor.points![i]}
                                                y={activeFloor.points![i+1]}
                                                radius={12}
                                                fill="white"
                                                stroke="#f59e0b" // Amber-500
                                                strokeWidth={3}
                                                draggable={!isSpacePressed}
                                                onDragStart={(e) => { e.cancelBubble = true; }}
                                                onDragMove={(e) => {
                                                    e.cancelBubble = true;
                                                    handleFloorPointDrag(i, e.target.x(), e.target.y());
                                                }}
                                                onDragEnd={(e) => { e.cancelBubble = true; }}
                                            />
                                        );
                                    })}
                                    </Group>
                                )}
                                
                                {/* 1m Grid */}
                                {renderGrid()}

                                {/* Floor Name Text */}
                                <Text
                                    x={20}
                                    y={20}
                                    text={`${activeFloor.name} (${activeFloor.width_cm / 100}m x ${activeFloor.height_cm / 100}m)`}
                                    fontSize={40}
                                    fill="#94a3b8"
                                    fontStyle="bold"
                                    opacity={0.5}
                                />

                                {/* Machines and Obstacles */}
                                {activeMachines.map((item) => {
                                    const isSelected = selectedId === item.id;
                                    
                                    // Base Colors
                                    let fillColor = COLORS[item.status] || '#94a3b8';
                                    let strokeColor = isSelected ? '#2563eb' : '#334155';
                                    let strokeW = isSelected ? 6 : 2;
                                    let dash: number[] = [];
                                    let opacity = isEditMode ? 0.4 : 0.2;

                                    // Specialized Styling based on Type
                                    if (item.type === 'wall') {
                                        fillColor = '#475569';
                                        opacity = 1;
                                    } else if (item.type === 'obstacle') {
                                        fillColor = '#94a3b8';
                                    } else if (item.type === 'safety_zone') {
                                        fillColor = 'rgba(234, 179, 8, 0.3)'; // Semi-transparent yellow
                                        strokeColor = '#ca8a04';
                                        dash = [20, 20]; // Caution tape dash
                                        strokeW = 4;
                                        opacity = 1;
                                    } else if (item.type === 'conveyor') {
                                        fillColor = 'transparent';
                                        strokeColor = '#3b82f6';
                                        dash = [15, 10];
                                        strokeW = 6;
                                        opacity = 1;
                                    } else if (item.type === 'rack') {
                                        fillColor = '#1e3a8a';
                                        strokeColor = '#93c5fd';
                                        opacity = 0.8;
                                    } else if (item.type === 'utility') {
                                        fillColor = 'transparent';
                                        strokeColor = '#ef4444'; // Red default for utility
                                        dash = [5, 5];
                                        opacity = 1;
                                    } else if (item.type === 'operator') {
                                        fillColor = '#f59e0b'; // Amber for humans
                                        opacity = 1;
                                    } else if (item.type === 'door') {
                                        fillColor = 'rgba(255, 255, 255, 0.5)';
                                        strokeColor = '#64748b';
                                        opacity = 1;
                                    } else if (isEditMode && isSelected) {
                                        fillColor = '#bfdbfe'; // Blue highlight for regular machines
                                    } else if (isEditMode && item.type === 'machine') {
                                        fillColor = '#e2e8f0';
                                    }

                                    return (
                                        <Group
                                            key={item.id}
                                            x={item.x_cm}
                                            y={item.y_cm}
                                            rotation={item.rotation}
                                            draggable={isEditMode && canEditLayout && !isSpacePressed}
                                            onDragEnd={(e) => handleDragEnd(e, item.id)}
                                            onClick={(e) => {
                                                if (e.evt.button === 2) e.evt.preventDefault(); // Ignore right click logic for MVP
                                                setSelectedId(item.id);
                                            }}
                                            onTap={() => setSelectedId(item.id)}
                                            onContextMenu={(e) => e.evt.preventDefault()}
                                            onMouseEnter={(e) => {
                                                if (!isEditMode && item.type === 'machine') {
                                                    setHoveredData({ item, x: e.evt.clientX, y: e.evt.clientY });
                                                }
                                                if (isEditMode) e.target.getStage()!.container().style.cursor = 'pointer';
                                            }}
                                            onMouseLeave={(e) => {
                                                setHoveredData(null);
                                                if (isEditMode) e.target.getStage()!.container().style.cursor = BLACK_CROSSHAIR;
                                            }}
                                            onMouseMove={(e) => {
                                                if (!isEditMode && item.type === 'machine') {
                                                    setHoveredData({ item, x: e.evt.clientX, y: e.evt.clientY });
                                                }
                                            }}
                                        >
                                            {item.type === 'text' ? (
                                                <Text
                                                    text={item.name}
                                                    width={item.width_cm}
                                                    height={item.height_cm}
                                                    align="center"
                                                    verticalAlign="middle"
                                                    fill={isSelected ? '#2563eb' : '#334155'}
                                                    fontFamily="Inter, sans-serif"
                                                    fontSize={Math.min(item.width_cm, item.height_cm) * 0.5} 
                                                    fontStyle="bold"
                                                    shadowColor="white"
                                                    shadowBlur={5}
                                                />
                                            ) : item.shape === 'circle' ? (
                                                <Group>
                                                    <Circle
                                                        x={item.width_cm / 2}
                                                        y={item.height_cm / 2}
                                                        radius={Math.min(item.width_cm, item.height_cm) / 2}
                                                        fill={fillColor}
                                                        stroke={strokeColor}
                                                        strokeWidth={strokeW}
                                                        dash={dash}
                                                        shadowColor="black"
                                                        shadowBlur={15}
                                                        shadowOpacity={isEditMode && item.type === 'machine' ? 0.4 : 0.2}
                                                    />
                                                    {isSelected && (
                                                        <Text x={item.width_cm / 2} y={-5} text={`Ø ${Math.round(Math.min(item.width_cm, item.height_cm))} cm`} fontSize={40} fill="#2563eb" fontStyle="bold" align="center" width={400} offsetX={200} offsetY={35} shadowColor="white" shadowBlur={4} shadowOpacity={1} listening={false} />
                                                    )}
                                                </Group>
                                            ) : item.shape === 'polygon' ? (
                                                <Group>
                                                    <Line
                                                        points={item.points || [0, 0, item.width_cm, 0, item.width_cm, item.height_cm, 0, item.height_cm]}
                                                        closed={item.type !== 'conveyor' && item.type !== 'utility'}
                                                        fill={fillColor}
                                                        stroke={strokeColor}
                                                        strokeWidth={strokeW}
                                                        dash={dash}
                                                        shadowColor="black"
                                                        shadowBlur={15}
                                                        shadowOpacity={opacity}
                                                    />
                                                    {item.type === 'safety_zone' && item.points && calculateArea(item.points) > 0 && (
                                                        <Text x={10} y={10} text={`${calculateArea(item.points).toFixed(1)} m²`} fill="#ca8a04" fontStyle="bold" />
                                                    )}
                                                    {isSelected && item.points && (
                                                        <Group>
                                                            {renderEdgeDimensions(item.points, item.type !== 'conveyor' && item.type !== 'utility', "#2563eb")}
                                                            {isEditMode && item.points.map((_, i) => {
                                                            if (i % 2 !== 0) return null;
                                                            return (
                                                                <Circle
                                                                    key={i}
                                                                    x={item.points![i]}
                                                                    y={item.points![i+1]}
                                                                    radius={8}
                                                                    fill="white"
                                                                    stroke="#2563eb"
                                                                    strokeWidth={3}
                                                                    draggable={!isSpacePressed}
                                                                    onDragStart={(e) => { e.cancelBubble = true; }}
                                                                    onDragMove={(e) => {
                                                                        e.cancelBubble = true;
                                                                        handlePointDrag(item.id, i, e.target.x(), e.target.y());
                                                                    }}
                                                                    onDragEnd={(e) => { e.cancelBubble = true; }}
                                                                />
                                                            );
                                                        })}
                                                        </Group>
                                                    )}
                                                </Group>
                                            ) : (
                                                <Group>
                                                    <Rect
                                                        width={item.width_cm}
                                                        height={item.height_cm}
                                                        fill={fillColor}
                                                        stroke={strokeColor}
                                                        strokeWidth={strokeW}
                                                        dash={dash}
                                                        cornerRadius={item.type === 'wall' || item.type === 'safety_zone' ? 0 : 10}
                                                        shadowColor="black"
                                                        shadowBlur={15}
                                                        shadowOpacity={opacity}
                                                    />
                                                    {isSelected && (
                                                        <Group listening={false}>
                                                            <Text x={item.width_cm / 2} y={-5} text={`${Math.round(item.width_cm)} cm`} fontSize={40} fill="#2563eb" fontStyle="bold" align="center" width={400} offsetX={200} offsetY={35} shadowColor="white" shadowBlur={4} shadowOpacity={1} />
                                                            <Text x={-5} y={item.height_cm / 2} text={`${Math.round(item.height_cm)} cm`} fontSize={40} fill="#2563eb" fontStyle="bold" align="center" width={400} offsetX={200} offsetY={35} rotation={-90} shadowColor="white" shadowBlur={4} shadowOpacity={1} />
                                                        </Group>
                                                    )}
                                                </Group>
                                            )}
                                            
                                            {/* Name Label (Hide for Text type since it renders itself) */}
                                            {item.type !== 'text' && (
                                                <Text
                                                    text={item.name}
                                                    width={item.width_cm}
                                                    height={item.height_cm}
                                                    align="center"
                                                    verticalAlign="middle"
                                                    fill={isEditMode ? '#1e293b' : 'white'}
                                                    fontFamily="Inter, sans-serif"
                                                    fontSize={Math.min(item.width_cm, item.height_cm) * 0.2} 
                                                    fontStyle="bold"
                                                />
                                            )}
                                        </Group>
                                    );
                                })}
                            </Layer>
                        </Stage>
                    </div>
                        </>
                    )}
                </div>

                {/* Right Sidebar: Properties Panel (Only in Edit Mode) */}
                {isEditMode && canEditLayout && (
                    <div className="w-80 shrink-0 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2"><Settings size={18} /> Properties Panel</h2>
                            <p className="text-xs text-slate-500 mt-1">Select an item to edit precise dimensions.</p>
                            <p className="text-[10px] text-blue-600 mt-2 font-medium bg-blue-50 p-1.5 rounded flex items-center gap-1"><MousePointer2 size={12}/> Shortcuts: Space (pan), Ctrl+C/V (copy/paste), Ctrl+D (duplicate), [ ] (layer).</p>
                        </div>
                        
                        <div className="p-4 flex-1 overflow-y-auto">
                            {!selectedMachine ? (
                                <div className="space-y-6">
                                    <div className="text-center pb-4 border-b border-slate-200">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                            <Settings size={20} className="text-slate-400" />
                                        </div>
                                        <h3 className="font-bold text-slate-700">Floor Properties</h3>
                                        <p className="text-xs text-slate-500">Edit the current zone settings</p>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Zone Name</label>
                                        <input 
                                            type="text" 
                                            value={activeFloor.name}
                                            onChange={(e) => updateFloor({ name: e.target.value })}
                                            className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 mb-3"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Floor Layout Shape</label>
                                        <select 
                                            value={activeFloor.shape || 'rect'}
                                            onChange={(e) => updateFloorShape(e.target.value as any)}
                                            className="w-full border border-slate-300 rounded p-2 text-sm mb-3"
                                        >
                                            <option value="rect">Rectangle Boundaries</option>
                                            <option value="polygon">Custom Irregular Polygon</option>
                                        </select>
                                    </div>

                                    {activeFloor.shape === 'polygon' && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                                            <h4 className="text-xs font-bold text-amber-800 mb-1">Boundary Nodes</h4>
                                            <p className="text-[10px] text-amber-700 mb-2">Drag the large amber dots on the canvas to edit walls.</p>
                                            <div className="flex gap-2">
                                                <button onClick={addFloorPolygonNode} className="flex-1 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded text-xs font-bold text-amber-700 shadow-sm">+ Add Corner</button>
                                                <button onClick={removeFloorPolygonNode} className="flex-1 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 rounded text-xs font-bold text-red-600 shadow-sm">- Remove</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Width (cm)</label>
                                            <input 
                                                type="number" 
                                                value={activeFloor.width_cm}
                                                onChange={(e) => updateFloor({ width_cm: Number(e.target.value) })}
                                                className="w-full border border-slate-300 rounded p-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Length (cm)</label>
                                            <input 
                                                type="number" 
                                                value={activeFloor.height_cm}
                                                onChange={(e) => updateFloor({ height_cm: Number(e.target.value) })}
                                                className="w-full border border-slate-300 rounded p-2 text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="text-xs text-slate-500 block mb-1">Background Floorplan Image</label>
                                        <div className="flex flex-col gap-2">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (evt) => {
                                                            if (evt.target?.result) {
                                                                updateFloor({ bg_image_url: evt.target.result as string });
                                                            }
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="w-full border border-slate-300 rounded p-1.5 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                            />
                                            {activeFloor.bg_image_url && (
                                                <button 
                                                    onClick={() => updateFloor({ bg_image_url: '' })}
                                                    className="text-xs text-red-500 text-left hover:underline w-max"
                                                >
                                                    Remove Background Image
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">Upload a CAD screenshot or 2D floor map to use as a tracing guide.</p>
                                    </div>

                                    <div className="pt-6 border-t border-slate-200">
                                        <button 
                                            onClick={handleAddMachine}
                                            className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                                        >
                                            <Plus size={18} /> Add New Object
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">Item Settings</h3>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Type</label>
                                                <select 
                                                    value={selectedMachine.type}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { type: e.target.value as any })}
                                                    className="w-full border border-slate-300 rounded p-2 text-sm"
                                                >
                                                    <option value="machine">🤖 Machine</option>
                                                    <option value="wall">🧱 Wall Line</option>
                                                    <option value="obstacle">🛢️ Obstacle</option>
                                                    <option value="safety_zone">🚧 Safety Zone</option>
                                                    <option value="conveyor">➡️ Conveyor / Path</option>
                                                    <option value="rack">🗄️ Storage Rack</option>
                                                    <option value="utility">⚡ Utility Line</option>
                                                    <option value="operator">👷 Operator Position</option>
                                                    <option value="door">🚪 Door</option>
                                                    <option value="text">📝 Text Label</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Shape</label>
                                                <select 
                                                    value={selectedMachine.shape}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { shape: e.target.value as any })}
                                                    className="w-full border border-slate-300 rounded p-2 text-sm"
                                                >
                                                    <option value="rect">Rectangle</option>
                                                    <option value="circle">Circle</option>
                                                    <option value="polygon">Custom Polygon</option>
                                                </select>
                                            </div>
                                        </div>
                                        {selectedMachine.shape === 'polygon' && (
                                            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-700 mb-1">Polygon Nodes</h4>
                                                <p className="text-[10px] text-slate-500 mb-2">Drag the blue dots on the canvas to edit corners.</p>
                                                <div className="flex gap-2">
                                                    <button onClick={() => addPolygonNode(selectedMachine.id)} className="flex-1 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-xs font-bold text-slate-700 shadow-sm">+ Add Corner</button>
                                                    <button onClick={() => removePolygonNode(selectedMachine.id)} className="flex-1 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 rounded text-xs font-bold text-red-600 shadow-sm">- Remove</button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-3 mt-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Display Text / Label</label>
                                                <input 
                                                    type="text" 
                                                    value={selectedMachine.name}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { name: e.target.value })}
                                                    className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {selectedMachine.type === 'safety_zone' && selectedMachine.shape === 'polygon' && selectedMachine.points && (
                                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center justify-between">
                                            <span className="text-xs font-bold text-yellow-800">Auto-Calculated Area:</span>
                                            <span className="text-sm font-black text-yellow-700">{calculateArea(selectedMachine.points).toFixed(2)} m²</span>
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">Dimensions (cm)</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Width (X)</label>
                                                <input 
                                                    type="number" 
                                                    value={selectedMachine.width_cm}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { width_cm: Number(e.target.value) })}
                                                    className="w-full border border-slate-300 rounded p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Length (Y)</label>
                                                <input 
                                                    type="number" 
                                                    value={selectedMachine.height_cm}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { height_cm: Number(e.target.value) })}
                                                    className="w-full border border-slate-300 rounded p-2 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-3">Position (cm)</h3>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Position X</label>
                                                <input 
                                                    type="number" 
                                                    value={selectedMachine.x_cm}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { x_cm: Number(e.target.value) })}
                                                    className="w-full border border-slate-300 rounded p-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Position Y</label>
                                                <input 
                                                    type="number" 
                                                    value={selectedMachine.y_cm}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { y_cm: Number(e.target.value) })}
                                                    className="w-full border border-slate-300 rounded p-2 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 block mb-1">Rotation (Degrees)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number" 
                                                    value={selectedMachine.rotation}
                                                    onChange={(e) => updateMachine(selectedMachine.id, { rotation: Number(e.target.value) })}
                                                    className="flex-1 border border-slate-300 rounded p-2 text-sm"
                                                />
                                                <button 
                                                    onClick={() => updateMachine(selectedMachine.id, { rotation: (selectedMachine.rotation + 90) % 360 })}
                                                    className="px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-sm font-medium"
                                                >
                                                    +90°
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <label className="text-xs text-slate-500 block mb-1">Quick Alignment</label>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => updateMachine(selectedMachine.id, { rotation: (selectedMachine.rotation + 180) % 360 })}
                                                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-medium"
                                                >
                                                    Flip 180°
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-200">
                                        <button 
                                            onClick={() => removeMachine(selectedMachine.id)}
                                            className="w-full py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-semibold transition-colors"
                                        >
                                            Remove Machine
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {revisionPanelOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setRevisionPanelOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><History size={18} /> {activeFloor.name} — Revision History</h3>
                            <button type="button" onClick={() => setRevisionPanelOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {revisionsLoading ? (
                                <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</p>
                            ) : revisions.length === 0 ? (
                                <p className="text-sm text-slate-500">No revisions yet. Saving creates snapshots (run factory_zone_layout_revisions.sql in Supabase).</p>
                            ) : (
                                <ul className="space-y-2">
                                    {revisions.map(row => (
                                        <li key={row.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">Revision v{row.revision_number}</p>
                                                <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</p>
                                            </div>
                                            <button type="button" onClick={() => restoreRevision(row)} className="px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700">Restore</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

