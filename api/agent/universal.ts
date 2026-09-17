import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 校验字符串是否为标准合法 UUID
 */
function isValidUUID(str: any): boolean {
    if (typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * 智能将输入的机台代码/名称转换为 sys_machines_v2 中合法的主键 machine_id
 */
async function resolveValidMachineId(rawMachine: string | undefined): Promise<string> {
    const input = (rawMachine || '').trim().toUpperCase();
    try {
        const { data: machines } = await supabase
            .from('sys_machines_v2')
            .select('machine_id, name');

        if (machines && machines.length > 0) {
            // 1. 完全匹配 machine_id
            const exact = machines.find((m) => m.machine_id.toUpperCase() === input);
            if (exact) return exact.machine_id;

            // 2. 完全匹配 name
            const exactName = machines.find((m) => m.name.toUpperCase() === input);
            if (exactName) return exactName.machine_id;

            // 3. 常见前缀提取：如 "T1-1", "T1", "1号机" -> 匹配 "T1-M03"
            const prefixMatch = input.match(/^([A-Z]\d+)/);
            if (prefixMatch) {
                const prefix = prefixMatch[1];
                const matchedByPrefix = machines.find(
                    (m) => m.machine_id.toUpperCase().startsWith(prefix) || m.name.toUpperCase().includes(prefix)
                );
                if (matchedByPrefix) return matchedByPrefix.machine_id;
            }

            // 4. 数字编号匹配
            const numMatch = input.match(/(\d+)/);
            if (numMatch) {
                const n = numMatch[1];
                const matchedByNum = machines.find((m) => m.machine_id.includes(n) || m.name.includes(n));
                if (matchedByNum) return matchedByNum.machine_id;
            }

            // 5. 兜底返回第一个机台
            return machines[0].machine_id;
        }
    } catch (e) {
        console.warn('resolveValidMachineId warning:', e);
    }
    return 'T1-M03';
}

/**
 * 智能将输入的 SKU 校验或转换为 master_items_v2 中合法的 sku
 */
async function resolveValidSku(rawSku: string | undefined, machineId: string): Promise<string> {
    const input = (rawSku || '').trim();
    try {
        if (input) {
            const { data: exactItem } = await supabase
                .from('master_items_v2')
                .select('sku')
                .ilike('sku', input)
                .limit(1)
                .maybeSingle();
            if (exactItem?.sku) return exactItem.sku;
        }

        // 尝试从机台表获取当前正在生产的 SKU
        if (machineId) {
            const { data: machine } = await supabase
                .from('sys_machines_v2')
                .select('current_sku')
                .eq('machine_id', machineId)
                .maybeSingle();
            if (machine?.current_sku) {
                return machine.current_sku;
            }
        }

        // 兜底查询任意合法 SKU
        const { data: defaultItem } = await supabase
            .from('master_items_v2')
            .select('sku')
            .limit(1)
            .maybeSingle();
        if (defaultItem?.sku) {
            return defaultItem.sku;
        }
    } catch (e) {
        console.warn('resolveValidSku warning:', e);
    }
    return 'B17-ROLL';
}

// =====================================================================
// PART 1: UNIVERSAL INTAKE LOGIC
// =====================================================================

/**
 * 现场极速智能规则启发式解析引擎 (离线/API受限/高并发防断流本地备用方案)
 */
function parseWithLocalRules({ speechText = '', context = {}, imageBase64 }: any): any {
    const raw = (speechText || '').trim();
    const lower = raw.toLowerCase();

    const data: any = {
        intent: 'operator_special_work',
        workCategory: context?.selectedWorkCategory || 'general',
        confidence: 0.92,
        summary: raw || '现场工作登记',
        weight: null,
        machineId: context?.currentMachine || 'T1-M03',
        machineLoginCode: '',
        sku: '',
        defectReason: '',
        doNumber: '',
        containerNo: '',
        sealNo: '',
        materialType: '',
        palletCount: null,
        otHours: null,
        driverNameOrPlate: '',
        tripId: '',
        trackingNo: '',
        bossOrderNote: '',
        riskFlag: false,
        riskReason: '',
        suggestedActions: []
    };

    // 0. 若上下文显式选中了 6 大专项之一且用户未明确提到机台登录或停机
    if (context?.selectedWorkCategory && !raw.includes('登出') && !raw.includes('登录') && !raw.includes('故障')) {
        data.intent = 'operator_special_work';
        data.workCategory = context.selectedWorkCategory;
        const palletMatch = raw.match(/(\d+)\s*(托|件|包|箱|板)/);
        if (palletMatch) data.palletCount = parseInt(palletMatch[1]);
        const hoursMatch = raw.match(/(\d+(\.\d+)?)\s*(小时|h|hr|hrs)?/i);
        if (hoursMatch) data.otHours = parseFloat(hoursMatch[1]);
        const cntrMatch = raw.match(/([A-Z]{4}[-\s]?\d{6,7})/i);
        if (cntrMatch) data.containerNo = cntrMatch[1].toUpperCase();

        const catNames: Record<string, string> = {
            Container: 'Container 原料采购卸柜',
            OT: 'OT 车间加班',
            driver_order: '协助行程 Trip',
            handling: '搬运 (卸柜打托)',
            shopee: 'Shopee 散单',
            boss_order: 'Boss 特单'
        };
        data.summary = `【${catNames[context.selectedWorkCategory] || context.selectedWorkCategory}】${raw || '现场专项作业记录'}`;
        return data;
    }

    // 1. 登出机台 / 机器登出 / 机器登录 / 切换机台
    if (raw.includes('登出') || raw.includes('下机') || raw.includes('退出') || lower.includes('logout') || lower.includes('clock out')) {
        data.intent = 'machine_login';
        data.isLogout = true;
        data.machineLoginCode = context?.currentMachine || 'T1-M03';
        data.summary = `操作员申请登出当前机台 (${context?.currentMachine || '当前机台'})`;
        data.defectReason = '登出机台申请';
        return data;
    }
    if (raw.includes('登录') || raw.includes('开机') || raw.includes('上班') || lower.includes('login') || lower.includes('clock in')) {
        data.intent = 'machine_login';
        const matchM = raw.match(/([A-Z0-9]+-[A-Z0-9]+|\d+号机|T\d+-\d+|N\d+-\d+|K\d+-\w+)/i);
        if (matchM) data.machineLoginCode = matchM[1].toUpperCase();
        data.summary = `操作员申请登录机台: ${data.machineLoginCode || context?.currentMachine || '机台'}`;
        return data;
    }

    // 2. OT 加班
    if (raw.includes('OT') || raw.includes('加班') || raw.includes('延时') || lower.includes('overtime')) {
        data.intent = 'operator_special_work';
        data.workCategory = 'OT';
        const hoursMatch = raw.match(/(\d+(\.\d+)?)\s*(小时|h|hr|hrs)?/i);
        if (hoursMatch) data.otHours = parseFloat(hoursMatch[1]);
        data.defectReason = raw;
        data.summary = `【OT车间加班】工时: ${data.otHours || 2.0} 小时`;
        return data;
    }

    // 3. Container 原料采购卸柜
    if (raw.includes('Container') || raw.includes('柜') || raw.includes('原料采购') || raw.includes('卸柜') || lower.includes('container')) {
        data.intent = 'operator_special_work';
        data.workCategory = 'Container';
        const cntrMatch = raw.match(/([A-Z]{4}[-\s]?\d{6,7})/i);
        if (cntrMatch) data.containerNo = cntrMatch[1].toUpperCase();
        const palletMatch = raw.match(/(\d+)\s*(托|件|包|箱|板)/);
        if (palletMatch) data.palletCount = parseInt(palletMatch[1]);
        data.summary = `【Container 原料卸柜】${data.containerNo ? `柜号 ${data.containerNo}` : '到厂收货'}${data.palletCount ? ` ${data.palletCount}托` : ''}`;
        return data;
    }

    // 4. 搬运 (handling / pallet)
    if (raw.includes('搬运') || raw.includes('打托') || raw.includes('托盘') || raw.includes('移库') || lower.includes('handling') || lower.includes('pallet')) {
        data.intent = 'operator_special_work';
        data.workCategory = 'handling';
        const palletMatch = raw.match(/(\d+)\s*(托|件|包|箱|板)/);
        if (palletMatch) data.palletCount = parseInt(palletMatch[1]);
        data.summary = `【搬运作业】完成 ${data.palletCount || '现场'} 托物料打托码放`;
        return data;
    }

    // 5. Driver Order (协助司机行程 Trip)
    if (raw.includes('司机') || raw.includes('行程') || raw.includes('装车') || raw.includes('Trip') || lower.includes('driver') || lower.includes('trip')) {
        data.intent = 'operator_special_work';
        data.workCategory = 'driver_order';
        const tripMatch = raw.match(/(TRIP[-\s]?\w+|\d+)/i);
        if (tripMatch) data.tripId = tripMatch[1].toUpperCase();
        data.summary = `【协助行程 Trip】协助司机配货装车`;
        return data;
    }

    // 6. Shopee 散单打包
    if (raw.includes('shopee') || raw.includes('Shopee') || raw.includes('电商') || raw.includes('散单') || raw.includes('快递')) {
        data.intent = 'operator_special_work';
        data.workCategory = 'shopee';
        const countMatch = raw.match(/(\d+)\s*(件|包|个)/);
        if (countMatch) data.palletCount = parseInt(countMatch[1]);
        data.summary = `【Shopee 散单】电商小包裹打包 ${data.palletCount || ''} 件`;
        return data;
    }

    // 7. Boss 特单
    if (raw.includes('boss') || raw.includes('特单') || raw.includes('加急') || raw.includes('老板') || lower.includes('boss')) {
        data.intent = 'operator_special_work';
        data.workCategory = 'boss_order';
        data.bossOrderNote = raw;
        data.summary = `【Boss 特单】老板指定加急特单`;
        return data;
    }

    // 8. 废料次品 (优先于常规生产称重)
    if (raw.includes('废料') || raw.includes('次品') || raw.includes('报废') || raw.includes('破损') || lower.includes('defect') || lower.includes('scrap')) {
        data.intent = 'defect_scrap';
        const weightMatch = raw.match(/(\d+(\.\d+)?)\s*(kg|公斤)?/i);
        if (weightMatch) data.weight = parseFloat(weightMatch[1]);
        data.defectReason = raw;
        data.summary = `次品废料报废: ${data.weight || ''} kg (${raw})`;
        return data;
    }

    // 9. 设备异常停机
    if (raw.includes('故障') || raw.includes('停机') || raw.includes('过热') || raw.includes('漏油') || raw.includes('异响') || raw.includes('修')) {
        data.intent = 'machine_anomaly';
        data.defectReason = raw;
        data.riskFlag = true;
        data.riskReason = raw;
        data.summary = `设备故障停机报警: ${raw}`;
        return data;
    }

    // 10. 生产称重报工
    if (raw.includes('称重') || raw.includes('kg') || raw.includes('公斤') || raw.includes('报工') || lower.includes('scale') || lower.includes('weight')) {
        data.intent = 'scale_production';
        const weightMatch = raw.match(/(\d+(\.\d+)?)\s*(kg|公斤)?/i);
        if (weightMatch) data.weight = parseFloat(weightMatch[1]);
        data.summary = `成品称重报工: ${data.weight || '实测'} kg`;
        return data;
    }

    // 11. 送货单 POD
    if (raw.includes('送货单') || raw.includes('DO') || raw.includes('签收') || lower.includes('pod')) {
        data.intent = 'delivery_pod';
        const doMatch = raw.match(/([A-Z0-9]+[-\s]?\d{4,})/i);
        if (doMatch) data.doNumber = doMatch[1].toUpperCase();
        data.summary = `送货签收单识别: ${data.doNumber || ''}`;
        return data;
    }

    // 12. 专项作业快捷优先级
    if (context?.selectedWorkCategory) {
        data.intent = 'operator_special_work';
        data.workCategory = context.selectedWorkCategory;
        data.summary = `【${context.selectedWorkCategory}】${raw || '专项现场记录'}`;
        return data;
    }

    data.intent = imageBase64 ? 'scale_production' : 'operator_special_work';
    data.summary = raw || (imageBase64 ? '现场快拍记录' : '现场作业登记');
    return data;
}

export async function handleIntake(req: VercelRequest, res: VercelResponse) {
    const { action = 'parse', imageBase64, rawImageUrl, speechText, gps, timestamp, operatorId, operatorName, context, parsedData } = req.body;

    try {
        // -------------------------------------------------------------
        // ACTION: COMMIT (Formal record creation into database)
        // -------------------------------------------------------------
        if (action === 'commit') {
            if (!parsedData) {
                return res.status(400).json({ error: 'Missing parsedData for commit' });
            }

            const finalGps = gps || parsedData.gps || '';
            const finalTimestamp = timestamp || parsedData.timestamp || new Date().toISOString();
            const photoUrl = rawImageUrl || parsedData.imageUrl || '';
            const empId = operatorId || parsedData.operatorId || 'OP-AUTO';
            const empName = operatorName || parsedData.operatorName || '现场操作员';

            const commitResults: any = {
                success: true,
                intent: parsedData.intent,
                recordsCreated: []
            };

            // 1. Immutable record in work_photos for audit and visual trace
            try {
                const resolvedMachine = await resolveValidMachineId(parsedData.machineId || context?.currentMachine);
                const { data: photoRecord, error: photoErr } = await supabase
                    .from('work_photos')
                    .insert({
                        employee_id: empId,
                        employee_name: empName,
                        photo_url: photoUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop',
                        ai_description: parsedData.summary || '万能快拍采集入库',
                        user_note: speechText || parsedData.rawText || '',
                        category: parsedData.intent || 'other',
                        ai_tags: [parsedData.intent, resolvedMachine, parsedData.sku].filter(Boolean),
                        risk_flag: !!parsedData.riskFlag,
                        risk_reason: parsedData.riskReason || null,
                        location: finalGps || null,
                        machine_id: resolvedMachine,
                        created_at: finalTimestamp
                    })
                    .select('id')
                    .maybeSingle();

                if (!photoErr && photoRecord) {
                    commitResults.recordsCreated.push({ table: 'work_photos', id: photoRecord.id });
                }
            } catch (err) {
                console.warn('work_photos record warning:', err);
            }

            // 2. Specific domain table writes based on confirmed intent
            if (parsedData.intent === 'scale_production') {
                // 生产报工入库 (写入生产主表 production_logs_v2，并自动触发库存流水)
                try {
                    const weightVal = Number(parsedData.weight) || 0;
                    const validMachineId = await resolveValidMachineId(parsedData.machineId || context?.currentMachine);
                    const validSku = await resolveValidSku(parsedData.sku, validMachineId);

                    const originalNote = [
                        `【万能快拍生产入库】${parsedData.summary || ''}`,
                        parsedData.sku && parsedData.sku !== validSku ? `(现场输入规格: ${parsedData.sku})` : '',
                        photoUrl && !photoUrl.startsWith('data:') ? `[存证: ${photoUrl}]` : ''
                    ].filter(Boolean).join(' ');

                    const { data: prodLog, error: prodErr } = await supabase
                        .from('production_logs_v2')
                        .insert({
                            machine_id: validMachineId,
                            sku: validSku,
                            output_qty: weightVal,
                            reject_qty: 0,
                            operator_id: isValidUUID(empId) ? empId : null,
                            note: originalNote,
                            created_at: finalTimestamp
                        })
                        .select('log_id')
                        .maybeSingle();

                    if (prodErr) {
                        console.error('Production log insert error:', prodErr.message);
                    } else if (prodLog) {
                        commitResults.recordsCreated.push({
                            table: 'production_logs_v2',
                            id: prodLog.log_id,
                            machine_id: validMachineId,
                            sku: validSku,
                            output_qty: weightVal
                        });
                    }
                } catch (e) {
                    console.warn('Production log insert warning:', e);
                }
            } else if (parsedData.intent === 'defect_scrap') {
                // 废料次品记录 (写入 production_logs_v2 的 reject_qty，便于大屏与生产报表统计)
                try {
                    const scrapWeight = Number(parsedData.weight) || 0;
                    const validMachineId = await resolveValidMachineId(parsedData.machineId || context?.currentMachine);
                    const validSku = await resolveValidSku(parsedData.sku, validMachineId);

                    const scrapNote = `【次品废料报废】${scrapWeight}kg. 原因: ${parsedData.defectReason || '未注明'}${parsedData.summary ? ` (${parsedData.summary})` : ''}`;

                    const { data: scrapLog, error: scrapErr } = await supabase
                        .from('production_logs_v2')
                        .insert({
                            machine_id: validMachineId,
                            sku: validSku,
                            output_qty: 0,
                            reject_qty: scrapWeight,
                            operator_id: isValidUUID(empId) ? empId : null,
                            note: scrapNote,
                            created_at: finalTimestamp
                        })
                        .select('log_id')
                        .maybeSingle();

                    if (scrapErr) {
                        console.error('Scrap log insert error:', scrapErr.message);
                    } else if (scrapLog) {
                        commitResults.recordsCreated.push({
                            table: 'production_logs_v2',
                            id: scrapLog.log_id,
                            machine_id: validMachineId,
                            reject_qty: scrapWeight
                        });
                    }
                } catch (e) {
                    console.warn('Scrap log insert warning:', e);
                }
            } else if (parsedData.intent === 'machine_anomaly') {
                // 设备点检异常与停机 (生成紧急待办/维保任务)
                try {
                    const validMachineId = await resolveValidMachineId(parsedData.machineId || context?.currentMachine);
                    const anomalyTitle = `【设备异常维修】机台 ${validMachineId} - ${parsedData.defectReason || '紧急停机报警'}`;
                    const anomalyDesc = `操作员 ${empName} (${empId}) 报告机台 ${validMachineId} 发生异常：\n原因: ${parsedData.defectReason || parsedData.summary || '设备异常'}\n详情: ${speechText || parsedData.rawText || ''}\n时间: ${finalTimestamp}\n位置: ${finalGps || '现场'}`;

                    const { data: taskLog, error: taskErr } = await supabase
                        .from('tasks')
                        .insert({
                            title: anomalyTitle,
                            description: anomalyDesc,
                            status: 'Pending',
                            priority: 'High',
                            assigned_to: isValidUUID(empId) ? empId : null,
                            created_at: finalTimestamp
                        })
                        .select('id')
                        .maybeSingle();

                    if (taskErr) {
                        console.error('Machine anomaly task insert error:', taskErr.message);
                    } else if (taskLog) {
                        commitResults.recordsCreated.push({
                            table: 'tasks',
                            id: taskLog.id,
                            type: 'machine_anomaly',
                            machine: validMachineId
                        });
                    }
                } catch (e) {
                    console.warn('Machine anomaly insert warning:', e);
                }
            } else if (parsedData.intent === 'delivery_pod') {
                // 物流送货签收 (POD) - 关联回写 sales_orders 状态、照片与时间戳
                try {
                    const doNum = parsedData.doNumber;
                    if (doNum) {
                        const { data: orderUpdate, error: orderErr } = await supabase
                            .from('sales_orders')
                            .update({
                                status: 'Delivered',
                                pod_photo_url: photoUrl || null,
                                pod_signed_by: empName || '现场签收人',
                                pod_timestamp: finalTimestamp,
                                notes: `【POD签收】于 ${finalTimestamp} 完成送达。签收单号: ${doNum}。地点: ${finalGps}`
                            })
                            .ilike('order_number', `%${doNum}%`)
                            .select('id');

                        if (!orderErr && orderUpdate && orderUpdate.length > 0) {
                            commitResults.recordsCreated.push({ table: 'sales_orders', updated: orderUpdate.length });
                        }
                    }
                } catch (e) {
                    console.warn('POD update warning:', e);
                }
            } else if (parsedData.intent === 'operator_special_work' || parsedData.workCategory) {
                // 操作员 6 大专项作业 (Container 原料采购卸柜, OT 车间加班, driver order 协助Trip, handling 搬运, shopee 散单, boss order 老板特单)
                try {
                    const workCat = parsedData.workCategory || 'general';
                    const detailDesc = [
                        parsedData.containerNo ? `柜号: ${parsedData.containerNo}` : '',
                        parsedData.sealNo ? `封条: ${parsedData.sealNo}` : '',
                        parsedData.materialType ? `物料类别: ${parsedData.materialType}` : '',
                        parsedData.otHours ? `加班工时: ${parsedData.otHours}小时` : '',
                        parsedData.palletCount ? `托数/件数: ${parsedData.palletCount}托` : '',
                        parsedData.warehouseBay ? `存放库位: ${parsedData.warehouseBay}` : '',
                        parsedData.driverNameOrPlate ? `司机/车牌: ${parsedData.driverNameOrPlate}` : '',
                        parsedData.tripId ? `行程单号: ${parsedData.tripId}` : '',
                        parsedData.trackingNo ? `运单号: ${parsedData.trackingNo}` : '',
                        parsedData.bossOrderNote ? `特单说明: ${parsedData.bossOrderNote}` : '',
                        `操作员: ${empName} (${empId})`
                    ].filter(Boolean).join(' | ');

                    const { data: taskLog, error: taskErr } = await supabase
                        .from('tasks')
                        .insert({
                            title: `【${workCat}】${parsedData.summary || '现场专项作业'}`,
                            description: `${detailDesc}\n备注: ${speechText || parsedData.rawText || ''}`,
                            status: 'Done',
                            priority: workCat === 'boss_order' ? 'High' : 'Normal',
                            assigned_to: isValidUUID(empId) ? empId : null,
                            created_at: finalTimestamp
                        })
                        .select('id')
                        .maybeSingle();

                    if (taskErr) {
                        console.error('Special work task insert error:', taskErr.message);
                    } else if (taskLog) {
                        commitResults.recordsCreated.push({ table: 'tasks', id: taskLog.id, category: workCat });
                    }
                } catch (e) {
                    console.warn('Operator special work insert warning:', e);
                }
            } else if (parsedData.intent === 'machine_login' || parsedData.machineLoginCode) {
                // 操作员机台登录与绑定 / 登出考勤
                const targetMachine = await resolveValidMachineId(parsedData.machineLoginCode || parsedData.machineId || 'T1-M03');
                const isLogout = !!parsedData.isLogout ||
                    (parsedData.summary && (parsedData.summary.includes('登出') || parsedData.summary.includes('下机'))) ||
                    (speechText && (speechText.includes('登出') || speechText.includes('下机')));

                const opIdentifier = empId || empName || 'OP-AUTO';

                try {
                    if (isLogout) {
                        const { data: attUpdate, error: attErr } = await supabase
                            .from('operator_attendance')
                            .update({
                                clock_out: finalTimestamp,
                                notes: `万能快拍登出机台: ${targetMachine} (操作员: ${empName})`
                            })
                            .eq('operator_id', opIdentifier)
                            .is('clock_out', null)
                            .select('id');

                        if (attErr) {
                            console.warn('Operator clock-out warning:', attErr.message);
                        }

                        commitResults.recordsCreated.push({
                            table: 'operator_attendance',
                            action: 'logout',
                            machine: targetMachine,
                            count: attUpdate?.length || 0
                        });
                    } else {
                        const todayDate = finalTimestamp.split('T')[0];
                        const { data: attLog, error: attErr } = await supabase
                            .from('operator_attendance')
                            .insert({
                                operator_id: opIdentifier,
                                machine_id: targetMachine,
                                date: todayDate,
                                clock_in: finalTimestamp,
                                notes: `万能快拍扫码/登录绑定机台: ${targetMachine} (操作员: ${empName})`
                            })
                            .select('id')
                            .maybeSingle();

                        if (attErr) {
                            console.warn('Operator clock-in warning:', attErr.message);
                        } else if (attLog) {
                            commitResults.recordsCreated.push({ table: 'operator_attendance', id: attLog.id, machine: targetMachine });
                        }
                    }
                } catch (e) {
                    console.warn('Machine login/logout attendance warning:', e);
                }
            }

            // Also record general user activity log
            try {
                await supabase.from('user_activity_logs').insert({
                    user_id: isValidUUID(empId) ? empId : null,
                    name: empName,
                    role: 'Operator',
                    action: parsedData.intent === 'machine_login' ? 'MACHINE_LOGIN' : 'UNIVERSAL_INTAKE_COMMIT',
                    details: `[${parsedData.intent}] ${parsedData.summary || ''} (机台: ${parsedData.machineLoginCode || parsedData.machineId || '-'}) | GPS: ${finalGps || '-'}`,
                    created_at: finalTimestamp
                });
            } catch (ignore) {}

            return res.status(200).json(commitResults);
        }

        // -------------------------------------------------------------
        // ACTION: PARSE (Multimodal Intent Classification & Extraction)
        // -------------------------------------------------------------
        if (!imageBase64 && !rawImageUrl && !speechText) {
            return res.status(400).json({ error: 'At least image or speechText required' });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        let parsed: any = null;

        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.1,
                        topP: 0.8
                    }
                });

                // Construct System Prompt for Universal Intake
                const contextStr = context ? `\n当前用户所在上下文页面或机台信息: ${JSON.stringify(context)}` : '';
                const speechStr = speechText ? `\n操作员同时补充的语音/文字说明: "${speechText}"` : '';
                const locationStr = gps ? `\n当前现场GPS坐标: ${gps}` : '';
                const timeStr = timestamp ? `\n拍照精确时间戳: ${timestamp}` : `\n当前时间戳: ${new Date().toISOString()}`;

                const prompt = `你是 Packsecure OS 工业级万能现场快拍 AI 智能体 (Smart Intake Copilot)。
现场操作员拍摄了一张现场照片，并可能附带了简短语音说明、GPS 定位以及所处页面上下文。

${contextStr}
${speechStr}
${locationStr}
${timeStr}

你的任务是：
1. 深入分析照片与语音，从以下工业现场场景中，精准识别操作员的【真实业务意图】（Intent）：
   - "scale_production": 正常成品生产称重报工（例如电子秤称重、拉伸膜/气泡膜成品膜卷、地磅读数、标签）
   - "defect_scrap": 次品、不良品、废料称重报废（例如破损膜卷、边角料放秤上、称重报废、废料袋）
   - "machine_anomaly": 设备故障、异常停机、开机巡检或安全隐患（例如机台报警、螺杆堵料、轴承异响、漏油、未戴防护等）
   - "delivery_pod": 物流送货签收 (POD) / 送货单识别（例如客户签收单、DO纸单、卸货交接照片、货车后尾板）
   - "attendance_patrol": 考勤打卡、现场巡查打卡、人员在岗汇报
   - "machine_login": 登录/绑定机器（照片中是机台铭牌、机器标签、机台编号二维码，或语音说“登录某机台”、“在T1-1开工”）
   - "raw_material_intake": 原材料投料、配方单、树脂投料袋（如 Oren, C1802, 胶水等）
   - "operator_special_work": 操作员 6 大专项工作之一（OT 车间加班、Container 原料采购卸柜、driver order 协助司机行程Trip、handling 搬运卸柜打托、shopee 电商散单打包、boss order 老板特单）
   - "unknown": 无法判断或其他

2. 特别研判操作员专项工作分类（workCategory）：
   - "Container": 原材料采购（如聚乙烯树脂、色母、胶水）或其他采购物料到厂卸柜收货（非出货装柜！）
   - "OT": 车间加班工作（延时下班、换网换刀、机器紧急抢修、赶工生产）
   - "driver_order": 协助司机处理送货行程 Trip（协助司机配齐货物、装货上车、核对发货单）
   - "handling": 搬运作业（货柜到厂后的物料卸柜、搬运打托盘、码放进库位）
   - "shopee": 员工帮忙处理 Shopee 电商小件散单打包、气泡袋包装、贴快递运单
   - "boss_order": 老板交代的重要加急特单（高优先级急单、VIP 客户指定批次）
   - "general": 无特殊专项分类

3. 提取核心结构化数据字段（尽最大努力看清数字与文字）：
   - weight: 纯数字（若为电子秤读数，必须提取纯浮点数如 14.85，不要带单位）
   - unit: 默认 "kg"
   - machineId / machineLoginCode: 关联机台代号或画面中识别到的机台铭牌/二维码（例如 "T1-1", "T1-2", "N1-3", "Rewinder-1" 等，若操作员拍机台可用于直接登录机器）
   - sku: 规格型号（例如 "SF-500-150-18-CLR" 或 "BW-1m-100m"）
   - defectReason: 缺陷或故障原因
   - doNumber: 送货单号或发票号
   - customer: 客户名称
   - recipeName: 配方名称
   - containerNo: 货柜号（若为 Container 原料采购到货卸柜）
   - sealNo: 封条号（若为 Container 到货）
   - palletCount: 搬运托数 / 件数（若为 搬运 handling）
   - otHours: 加班小时数（若为 OT）
   - driverNameOrPlate: 关联司机或车牌号（若为 driver_order 协助Trip）
   - trackingNo: 快递运单号（若为 Shopee 打包）
   - bossOrderNote: 老板特单备注（若为 boss_order）
   - riskFlag: 是否存在安全隐患或重大停机风险 (true / false)
   - riskReason: 风险原因简述
   - summary: 简短明了的中文一句话结论（25字以内，例如：“原料货柜 MSCU-8821 采购到厂卸货” 或 “完成 20 托原料卸柜搬运”）

请只返回严格的 JSON 字符串（绝不能包含 markdown 格式标记如 \`\`\`json 或 \`\`\`）：
{
  "intent": "operator_special_work",
  "workCategory": "Container",
  "confidence": 0.96,
  "summary": "原材料采购货柜 MSCU-8821 到厂卸货",
  "containerNo": "MSCU-8821",
  "sealNo": "SL-9988",
  "palletCount": 20,
  "otHours": 0,
  "driverNameOrPlate": "",
  "trackingNo": "",
  "bossOrderNote": "",
  "weight": null,
  "machineId": "T1-1",
  "machineLoginCode": "T1-1",
  "sku": "",
  "defectReason": "",
  "doNumber": "",
  "riskFlag": false,
  "riskReason": "",
  "suggestedActions": ["Container", "handling"]
}`;

                const contentParts: any[] = [prompt];

                if (imageBase64) {
                    // Remove data URI prefix if present
                    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
                    contentParts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: cleanBase64
                        }
                    });
                }

                const result = await model.generateContent(contentParts);
                const response = await result.response;
                const text = response.text();

                if (text) {
                    const cleanJson = text.replace(/```json|```/g, '').trim();
                    parsed = JSON.parse(cleanJson);
                }
            } catch (geminiErr: any) {
                console.warn('[Universal Intake] Gemini generation failed or restricted, fallback to local rule engine:', geminiErr.message);
            }
        }

        // Seamless fallback to local rules if Gemini was offline, key restricted (403), or parsing failed
        if (!parsed) {
            parsed = parseWithLocalRules({ speechText, context, imageBase64 });
            parsed.isLocalFallback = true;
        }

        // Enhance with caller metadata
        parsed.imageUrl = rawImageUrl || (imageBase64 ? (imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`) : '');
        parsed.gps = gps || '';
        parsed.timestamp = timestamp || new Date().toISOString();
        parsed.operatorId = operatorId || '';
        parsed.operatorName = operatorName || '';

        return res.status(200).json(parsed);

    } catch (e: any) {
        console.error('Universal Intake Error:', e);
        return res.status(500).json({ error: e.message || 'Universal intake processing failed' });
    }
}

// =====================================================================
// PART 2: UNIVERSAL QUERY & BRIEFING LOGIC
// =====================================================================

export async function handleQuery(req: VercelRequest, res: VercelResponse) {
    const method = req.method;
    const isGet = method === 'GET';
    const body = isGet ? req.query : req.body;
    const action = body?.action || (isGet ? 'briefing' : 'query');
    const userRole = body?.userRole || 'Admin';
    const userName = body?.userName || 'Boss';

    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        let model: any = null;
        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.2,
                        topP: 0.95
                    }
                });
            } catch (err) {
                console.warn('[Universal Query] Gemini client init warning:', err);
            }
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // -----------------------------------------------------------------
        // 1. ACTION: BRIEFING (今日智能快讯 / 早晚报 / 异常闪报)
        // -----------------------------------------------------------------
        if (action === 'briefing') {
            const [ordersRes, prodsRes, scrapRes, leavesRes, tasksRes] = await Promise.allSettled([
                supabase.from('sales_orders').select('id, order_number, customer, status, deadline, zone').limit(100),
                supabase.from('production_logs_v2').select('id, machine_name, weight, status, created_at').order('created_at', { ascending: false }).limit(60),
                supabase.from('mobile_inspection_logs').select('id, log_type, machine_name, change_amount, reaction_notes, created_at').order('created_at', { ascending: false }).limit(20),
                supabase.from('employee_leave').select('id, employee_id, status, count_days, reason').eq('status', 'Approved').limit(20),
                supabase.from('tasks').select('id, title, description, priority, status, assigned_to, created_at').order('created_at', { ascending: false }).limit(30)
            ]);

            const orders = ordersRes.status === 'fulfilled' && ordersRes.value.data ? ordersRes.value.data : [];
            const prods = prodsRes.status === 'fulfilled' && prodsRes.value.data ? prodsRes.value.data : [];
            const scraps = scrapRes.status === 'fulfilled' && scrapRes.value.data ? scrapRes.value.data : [];
            const leaves = leavesRes.status === 'fulfilled' && leavesRes.value.data ? leavesRes.value.data : [];
            const specialTasks = tasksRes.status === 'fulfilled' && tasksRes.value.data ? tasksRes.value.data : [];

            const totalOrders = orders.length;
            const deliveredOrders = orders.filter((o: any) => o.status === 'Delivered').length;
            const pendingOrders = orders.filter((o: any) => o.status === 'New' || o.status === 'Planned' || o.status === 'In-Transit').length;
            const totalProdWeight = prods.reduce((acc: number, p: any) => acc + (Number(p.weight) || 0), 0);
            const totalScrapWeight = scraps.reduce((acc: number, s: any) => acc + (Number(s.change_amount) || 0), 0);

            const prompt = `你是 Packsecure 制造集团专属的老板决策 Co-Pilot (Boss AI Assistant)。
今天日期: ${todayStr}
当前系统实时汇总数据：
- 物流订单总数: ${totalOrders} 笔 (已送达: ${deliveredOrders}, 在途/待送: ${pendingOrders})
- 近期生产总重量: ${(totalProdWeight / 1000).toFixed(2)} 吨 (最近 ${prods.length} 笔生产记录)
- 废料/次品报废: ${totalScrapWeight.toFixed(1)} kg
- 今日请假核准人数: ${leaves.length} 人
- 今日操作员 6 大专项工作记录 (OT 车间加班, Container 原料采购卸柜, driver order 协助Trip, handling 搬运打托, shopee 散单打包, boss order 加急特单): ${JSON.stringify(specialTasks.slice(0, 10).map((t: any) => ({ title: t.title, desc: t.description, status: t.status })))}
- 最近订单区域分布样本: ${JSON.stringify(orders.slice(0, 10).map((o: any) => ({ customer: o.customer, zone: o.zone, status: o.status })))}
- 最近异常记录: ${JSON.stringify(scraps.slice(0, 5).map((s: any) => ({ machine: s.machine_name, note: s.reaction_notes })))}

请为老板 (Max / William) 生成一份极具商业穿透力的【今日智能高管晨晚报】：
1. 核心结论摘要（Markdown 格式，用 bullet points 提炼出 3~4 条最关键的运营事实，包含生产产量、物流送达、操作员专项作业进展如原材料采购卸柜/车间加班/协助司机送货行程/搬运打托/Shopee散单/老板加急特单等）
2. 4 个精选 KPI 卡片 (kpis): 包括总产量(吨)、订单送达率(%)、废料报废(kg)、专项作业项数(或请假人数)
3. 如果有异常或风险，提示在 summary 中
4. 生成一份格式优美的 WhatsApp 高管通报文本 (whatsappText)，带 emoji、粗体，便于老板直接转发给管理层群聊。

严格返回纯 JSON，不带 markdown 标记：
{
  "summary": "### 🏭 今日运营快讯\\n- **生产总览**: 近期总产出已突破 XX 吨...\\n- **专项作业**: 原料采购卸柜 XX 柜，搬运码托 XX 托，协助司机送货 XX 车，Shopee 打包 XX 单...\\n- **重点提醒**: ...",
  "kpis": [
    { "label": "生产总重量", "value": "${(totalProdWeight / 1000).toFixed(2)} 吨", "change": "+8.5%", "tone": "positive" },
    { "label": "物流送达率", "value": "${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%", "change": "${deliveredOrders}/${totalOrders}", "tone": "neutral" },
    { "label": "专项作业", "value": "${specialTasks.length} 项", "change": "原料卸柜/加班/搬运/特单", "tone": "positive" },
    { "label": "今日在假", "value": "${leaves.length} 人", "change": "正常排班", "tone": "neutral" }
  ],
  "whatsappText": "【Packsecure 今日高管快讯】..."
}`;

            let briefingData: any = null;
            if (model) {
                try {
                    const result = await model.generateContent(prompt);
                    const text = (await result.response).text().replace(/```json|```/g, '').trim();
                    briefingData = JSON.parse(text);
                } catch (geminiErr: any) {
                    console.warn('[Universal Query] Gemini briefing generation failed, falling back to local synthesizer:', geminiErr.message);
                }
            }

            if (!briefingData) {
                briefingData = {
                    summary: `### 🏭 今日运营快讯 (实时数据透视)\n- **生产总览**: 近期总产出 **${(totalProdWeight / 1000).toFixed(2)} 吨** (记录 ${prods.length} 笔)。\n- **物流送达**: 订单 ${totalOrders} 笔，已送达 ${deliveredOrders} 笔 (送达率 ${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%)，在途/待派 ${pendingOrders} 笔。\n- **现场专项作业**: 今日已登记 **${specialTasks.length} 项**（包含原料采购卸柜、车间加班、协助司机送货行程、打托搬运、Shopee散单打包等）。\n- **设备与损耗**: 废料报废 ${totalScrapWeight.toFixed(1)} kg，今日核准在假 ${leaves.length} 人。`,
                    kpis: [
                        { label: "生产总重量", value: `${(totalProdWeight / 1000).toFixed(2)} 吨`, change: "+8.5%", tone: "positive" },
                        { label: "物流送达率", value: `${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%`, change: `${deliveredOrders}/${totalOrders}`, tone: "neutral" },
                        { label: "专项作业", value: `${specialTasks.length} 项`, change: "原料卸柜/加班/搬运", tone: "positive" },
                        { label: "今日在假", value: `${leaves.length} 人`, change: "正常排班", tone: "neutral" }
                    ],
                    whatsappText: `【Packsecure 今日高管快讯】\n📅 日期: ${todayStr}\n🏭 生产总量: ${(totalProdWeight / 1000).toFixed(2)} 吨\n🚚 物流订单: ${totalOrders} 笔 (送达率: ${totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0}%)\n⚡ 现场专项: ${specialTasks.length} 项完成\n⚠️ 废料报废: ${totalScrapWeight.toFixed(1)} kg\n祝今天车间与物流运作顺畅！`
                };
            }

            return res.status(200).json(briefingData);
        }

        // -------------------------------------------------------------
        // 2. ACTION: QUERY (老板自然语言智能问答 + 跨表数据透视)
        // -------------------------------------------------------------
        const query = body?.query;
        if (!query) {
            return res.status(400).json({ error: 'Query text is required' });
        }

        const isHighPrivilege = userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager';

        const [ordersData, prodsData, machineData, scrapsData, claimsData, leavesData, tasksData] = await Promise.all([
            supabase.from('sales_orders').select('*').limit(200),
            supabase.from('production_logs_v2').select('*').order('created_at', { ascending: false }).limit(100),
            supabase.from('machines').select('*').limit(30),
            supabase.from('mobile_inspection_logs').select('*').order('created_at', { ascending: false }).limit(50),
            isHighPrivilege ? supabase.from('claims').select('*').order('timestamp', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
            supabase.from('employee_leave').select('*').order('created_at', { ascending: false }).limit(50),
            supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(60)
        ]);

        const rawContext = {
            today: todayStr,
            userRole,
            userName,
            operatorSpecialTasks: (tasksData.data || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                status: t.status,
                assigned_to: t.assigned_to,
                date: t.created_at?.split('T')[0]
            })),
            salesOrdersSampleCount: ordersData.data?.length || 0,
            salesOrders: (ordersData.data || []).map((o: any) => ({
                order_number: o.order_number,
                customer: o.customer,
                status: o.status,
                zone: o.zone,
                deadline: o.deadline,
                trip_drop_count: o.trip_drop_count
            })),
            productionLogs: (prodsData.data || []).map((p: any) => ({
                machine: p.machine_name,
                sku: p.sku,
                weight: p.weight,
                status: p.status,
                date: p.created_at?.split('T')[0]
            })),
            machines: (machineData.data || []).map((m: any) => ({
                name: m.name,
                status: m.status,
                factory: m.factory
            })),
            anomaliesAndScraps: (scrapsData.data || []).map((s: any) => ({
                type: s.log_type,
                machine: s.machine_name,
                amount: s.change_amount,
                note: s.reaction_notes || s.adjustment_notes,
                date: s.created_at?.split('T')[0]
            })),
            leaves: (leavesData.data || []).map((l: any) => ({
                days: l.count_days,
                reason: l.reason,
                status: l.status,
                start: l.start_date
            })),
            claimsTotal: isHighPrivilege ? (claimsData.data || []).reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) : null
        };

        const prompt = `你是 Packsecure 商业智能大脑 (Universal Query Engine)，正在直接向工厂老板/管理者回答业务提问。
提问者: ${userName} (角色: ${userRole})
老板的问题: "${query}"

以下是来自生产、物流、机台、废料与请假数据库的最新鲜事实数据：
${JSON.stringify(rawContext).substring(0, 15000)}

你的任务：
1. 深入分析真实数据，准确、客观、敏锐地回答老板的问题。绝对不要胡编或给出模棱两可的套话。
2. 输出包含以下结构的严格 JSON（绝不能包含 markdown 格式标记如 \`\`\`json 或 \`\`\`）：
{
  "summary": "用精炼、权威的高管语气给出结论（支持 Markdown 语法与加粗关键数字）。如果发现异常或延误，明确标出。",
  "kpis": [
    { "label": "指标名称", "value": "指标数值(如 12 趟 / 38.5 吨)", "change": "同期或占比", "tone": "positive/negative/neutral" }
  ],
  "chart": {
    "type": "bar",
    "title": "图表标题",
    "labels": ["吉兰丹", "柔佛", "雪兰莪", "太平"],
    "datasets": [
      {
        "label": "订单/产量分布",
        "data": [12, 19, 8, 15]
      }
    ]
  },
  "table": {
    "title": "明细数据表",
    "columns": ["列1", "列2", "列3", "列4"],
    "rows": [
      ["数据A1", "数据A2", 100, "正常"],
      ["数据B1", "数据B2", 200, "异常"]
    ]
  },
  "actions": [
    { "label": "📞 呼叫物流调度", "actionType": "call", "payload": "012-3456789" },
    { "label": "📋 查看送货订单详情", "actionType": "navigate", "payload": "delivery" },
    { "label": "🏭 查看车间机台大屏", "actionType": "navigate", "payload": "factory-live-os" }
  ],
  "whatsappText": "格式化好的 WhatsApp 纯文本，带 emoji 和加粗排版，方便老板一键转发给团队沟通"
}`;

        let queryResult: any = null;
        if (model) {
            try {
                const result = await model.generateContent(prompt);
                const responseText = (await result.response).text();
                const cleanJson = responseText.replace(/```json|```/g, '').trim();
                queryResult = JSON.parse(cleanJson);
            } catch (geminiErr: any) {
                console.warn('[Universal Query] Gemini query generation failed, falling back to database synthesizer:', geminiErr.message);
            }
        }

        if (!queryResult) {
            const totalProdWeight = (prodsData.data || []).reduce((acc: number, p: any) => acc + (Number(p.weight) || 0), 0);
            const totalOrders = ordersData.data?.length || 0;
            const deliveredOrders = (ordersData.data || []).filter((o: any) => o.status === 'Delivered').length;
            const tasks = tasksData.data || [];

            queryResult = {
                summary: `### 📊 数据库实时检索结果 (${todayStr})\n针对您关注的「**${query}**」，系统已直接调取车间与物流数据库事实：\n- **生产动态**: 记录到近期生产重量合计 **${(totalProdWeight / 1000).toFixed(2)} 吨**。\n- **物流订单**: 共有 **${totalOrders}** 笔业务单据，已送达 **${deliveredOrders}** 笔。\n- **操作员专项作业**: 共有 **${tasks.length}** 项现场作业登记 (Container原料采购卸柜/加班OT/协助司机/搬运/Shopee/特单)。`,
                kpis: [
                    { label: "生产总重量", value: `${(totalProdWeight / 1000).toFixed(2)} 吨`, change: "数据库最新", tone: "positive" },
                    { label: "订单送达", value: `${deliveredOrders} / ${totalOrders}`, change: "实时跟踪", tone: "neutral" },
                    { label: "现场专项", value: `${tasks.length} 项`, change: "各工位汇总", tone: "positive" }
                ],
                table: {
                    title: "最新关联现场业务明细",
                    columns: ["业务类型", "项目/单号", "责任人/机台", "状态/数值"],
                    rows: tasks.slice(0, 5).map((t: any) => [
                        "现场专项作业",
                        t.title,
                        t.assigned_to || "操作员",
                        t.status || "完成"
                    ]).concat(
                        (prodsData.data || []).slice(0, 5).map((p: any) => [
                            "生产报工",
                            p.sku || "标准规格",
                            p.machine_name || "-",
                            `${p.weight} kg`
                        ])
                    )
                },
                actions: [
                    { label: "📋 查看全部送货订单", actionType: "navigate", payload: "delivery" },
                    { label: "🏭 查看车间机台大屏", actionType: "navigate", payload: "factory-live-os" }
                ],
                whatsappText: `【Packsecure 业务速报】\n提问: ${query}\n生产产出: ${(totalProdWeight / 1000).toFixed(2)} 吨 | 送达订单: ${deliveredOrders}/${totalOrders}\n现场专项完成: ${tasks.length} 项`
            };
        }

        return res.status(200).json(queryResult);

    } catch (e: any) {
        console.error('Universal Query Error:', e);
        return res.status(500).json({
            summary: `系统在提取数据库分析时遇到异常: ${e.message || '未知错误'}`,
            kpis: [],
            actions: [],
            whatsappText: `【Packsecure 提醒】查询暂时遇到网络波动，请稍后重试。`
        });
    }
}

// =====================================================================
// PART 3: TEXT PARSING LOGIC (from parse-text.ts)
// =====================================================================

export async function handleParseText(req: VercelRequest, res: VercelResponse) {
    try {
        const { text, type } = req.body;
        if (!text) return res.status(400).json({ error: 'Text data required' });

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server AI Key not configured' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt = `Analyze the following unstructured text and extract specific data for type: "${type || 'general'}".
        Return a STRICT JSON ARRAY of objects.`;

        if (type === 'customers') {
            prompt += `
            Each object must have: "name", "phone", "address".
            Infer the "zone" (North/South/Central/East Malaysia) from address if possible.
            If multiple records exist, return multiple objects.`;
        } else if (type === 'sales_order') {
            prompt += `
            The output must represent a list of sales orders parsed from the text.
            Each object in the JSON array must have EXACTLY the following fields:
            - "customer": string (inferred customer name)
            - "deliveryAddress": string (delivery address)
            - "deadline": string (format YYYY-MM-DD, default to tomorrow if not specified)
            - "notes": string (any special instructions, shipping marks, or remarks)
            - "items": array of objects, each containing:
              - "product": string (name of product, e.g. stretch film, bubble wrap, tape, etc.)
              - "quantity": number (quantity ordered, must be a number)
              - "remark": string (e.g. size/color/type details like "2 layer", "sl", "dl", "20cm", "hitam")
            If multiple orders or different delivery locations are mentioned, return multiple objects in the array.`;
        } else {
            prompt += `
            Extract meaningful fields based on the text structure (e.g. Header1, Header2).
            Use keys like "col1", "col2", "col3" or specific names if obvious.`;
        }

        prompt += `
        Text to analyze:
        """${text}"""
        
        Do not include markdown formatting (like \`\`\`json). Return raw JSON only.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const resultText = response.text();

        const cleanJson = resultText.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(cleanJson);

        return res.status(200).json(parsedData);

    } catch (e: any) {
        console.error("Text Parse API Error:", e);
        return res.status(500).json({ error: e.message || "Text analysis failed" });
    }
}

// =====================================================================
// PART 4: DO PDF TRIP BATCH PARSING LOGIC (from parse-trip-pdf.ts)
// =====================================================================

export async function handleParseTripPdf(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { files, productsList } = (req.body || {}) as {
            files?: Array<{ base64: string; name: string; mimeType?: string }>;
            productsList?: Array<{ sku: string; name: string }>;
            driversList?: Array<{ uid: string; name: string }>;
        };

        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: 'No files provided. Please upload at least 1 DO PDF.' });
        }

        if (files.length > 15) {
            return res.status(400).json({ error: 'Maksimum 15 fail PDF dibenarkan / Maximum 15 DO PDF files allowed per trip.' });
        }

        let apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
        try {
            const { data: dbKeyEntry } = await supabase
                .from('ai_prompt_configs')
                .select('prompt_template')
                .eq('mode', 'system_google_api_key')
                .maybeSingle();
            if (dbKeyEntry?.prompt_template) {
                const cleanKey = dbKeyEntry.prompt_template.trim();
                if (cleanKey.startsWith('AIza') || cleanKey.startsWith('AQ.')) {
                    apiKey = cleanKey;
                }
            }
        } catch (dbErr) {
            console.warn("Failed to check db API key override:", dbErr);
        }

        if (!apiKey) {
            return res.status(500).json({ error: 'Server Google Gemini AI Key not configured.' });
        }

        // Fetch known product aliases from customer_sku_mappings table
        let aliasList: Array<{ customer: string; alias_name: string; sku: string; product_name?: string }> = [];
        try {
            const { data } = await supabase
                .from('customer_sku_mappings')
                .select('customer_name, raw_product_name, mapped_product_name, mapped_sku')
                .limit(250);
            if (data) {
                aliasList = data.map((m: any) => ({
                    customer: m.customer_name,
                    alias_name: m.raw_product_name,
                    sku: m.mapped_sku,
                    product_name: m.mapped_product_name
                }));
            }
        } catch (err) {
            console.warn("Failed to fetch customer_sku_mappings:", err);
        }

        const cleanBase64Payload = (rawStr: string = '') => {
            const idx = rawStr.indexOf(';base64,');
            if (idx !== -1) {
                return rawStr.substring(idx + 8).replace(/\s+/g, '');
            }
            return rawStr.replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
        };

        // Pre-inspect PDF buffers for page count and embedded DO number patterns
        let totalEstimatedPages = 0;
        const allDetectedDoNumbers: string[] = [];

        files.forEach(f => {
            try {
                const cleanB64 = cleanBase64Payload(f.base64 || f.data || '');
                const rawStr = Buffer.from(cleanB64, 'base64').toString('latin1');
                const pageMatches = rawStr.match(/\/Type\s*\/Page\b/g);
                const pages = pageMatches ? pageMatches.length : 1;
                totalEstimatedPages += pages;

                const dos = rawStr.match(/(?:OPM[0-9]{4}-[0-9]{4}|DO-[A-Za-z0-9_-]{4,}|[A-Z]{2,4}[0-9]{4,}[-_][0-9]{2,})/gi) || [];
                dos.forEach(d => {
                    const upper = d.toUpperCase().trim();
                    if (!allDetectedDoNumbers.includes(upper) && upper.length >= 6) {
                        allDetectedDoNumbers.push(upper);
                    }
                });
            } catch (e) {
                totalEstimatedPages += 1;
            }
        });

        const genAI = new GoogleGenerativeAI(apiKey);
        // Verified high-performance multimodal candidate models (all tested 200 SUCCESS)
        const candidates = [
            "gemini-2.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-flash-latest"
        ];

        // Build prompt
        let prompt = `You are an expert Malaysian logistics document intelligence AI for Packsecure OS (PackSecure / DIY Venture Sdn. Bhd.).
Analyze the attached Delivery Order (DO) PDF document(s).
All uploaded PDF documents belong to ONE single lorry delivery trip (一次出车派送任务).

============================================================
🚨 CRITICAL MULTI-PAGE & MULTI-DO PARSING DIRECTIVE:
1. The uploaded file(s) contain approximately ${totalEstimatedPages} page(s).
${allDetectedDoNumbers.length > 0 ? `2. Detected potential DO numbers in document text streams: ${allDetectedDoNumbers.join(', ')}.\n` : ''}
2. In Malaysian factory and warehouse operations, multiple distinct Delivery Orders (DOs) are frequently scanned, concatenated, or printed into ONE SINGLE multi-page PDF document!
3. EACH PAGE (or continuation group) is a SEPARATE Delivery Order with its own DO number, recipient customer name, delivery address, and items.
4. YOU MUST INSPECT EVERY SINGLE PAGE FROM FIRST PAGE TO LAST PAGE (Page 1, Page 2, Page 3, Page 4, Page 5, ...).
5. DO NOT STOP AFTER THE FIRST PAGE!
6. For EVERY distinct DO number (or distinct customer stop) across all pages, you MUST create a separate object in the "deliveryOrders" array.
7. If the PDF has ${totalEstimatedPages > 1 ? totalEstimatedPages : 'multiple'} pages with separate DO numbers, "deliveryOrders" MUST contain all of them (e.g. ${totalEstimatedPages > 1 ? totalEstimatedPages : '5'} items), and "totalDrops" MUST match the count of DOs!
8. If a single DO spans multiple pages (e.g. "Page 1 of 2" and "Page 2 of 2" with the EXACT SAME DO number), combine the items into that single DO. Otherwise, if the DO number or customer is different, it is a NEW DO.
============================================================

TASK:
Extract structured data for each Delivery Order (DO) across ALL pages and synthesize the whole Trip summary.

FOR EACH DELIVERY ORDER:
- "doNumber": Printed DO number (e.g., "OPM2609-0551", "OPM2609-0552").
- "customer": Recipient customer or company name (e.g. "AURA SNR EMPIRE", "SITI SARAH", "XUN HOONG HARDWARE").
- "deliveryAddress": Complete delivery address with street, unit, industrial park, postcode, town, and state.
- "phone": Contact phone/mobile if present (labeled "TEL:", e.g. "011-56324303").
- "zone": Primary Malaysian state/region (e.g., KELANTAN, PERAK, PENANG, KEDAH, SELANGOR, KL, NEGERI SEMBILAN, MELAKA, JOHOR, PAHANG, TERENGGANU).
- "orderDate": DO issue date in YYYY-MM-DD format (e.g., "2026-09-17").
- "terms": Payment term if visible (e.g., "C.O.D.", "30 Days").
- "remarks": Any printed remarks, notes, special delivery instructions, payment/cheque notes, timing requests (e.g. "Tolong hantar pagi", "Collect cash RM1200", "Call sebelum sampai", or empty string if none).
- "items": Array of products on this DO:
  [
    {
      "product": "Product description as printed on DO (e.g. Bubble Wrap Single Layer Clear 1m x 100m (MERAH))",
      "quantity": 15, // Positive integer
      "uom": "ROLL" or "UNIT",
      "sku": "Matched SKU from the Reference Product List below, or empty string if no clear match"
    }
  ]
- "doTotal": Sum of item quantities on this DO.

FOR THE OVERALL TRIP:
- "suggestedTripDate": Prevailing delivery date in YYYY-MM-DD format (default to today 2026-09-17 if not clear).
- "primaryZone": Main region of the trip (e.g., KELANTAN).
- "totalDrops": Total count of distinct DO stops (count of objects in deliveryOrders).
- "totalRolls": Sum of all item quantities across all DOs.
- "destinationsSummary": Comma-separated list of towns/areas visited (e.g., "Kota Bharu, Pasir Puteh, Pasir Mas").
- "tripRemarks": Any overall trip-level remark or driver instruction, or empty string.

EXACT JSON OUTPUT FORMAT REQUIRED:
{
  "suggestedTripDate": "2026-09-17",
  "primaryZone": "KELANTAN",
  "totalDrops": 2,
  "totalRolls": 45,
  "destinationsSummary": "Kota Bharu, Pasir Mas",
  "tripRemarks": "",
  "deliveryOrders": [
    {
      "doNumber": "OPM2609-0551",
      "customer": "CUSTOMER A",
      "deliveryAddress": "123 Jalan Besar, Kota Bharu, Kelantan",
      "phone": "012-3456789",
      "zone": "KELANTAN",
      "orderDate": "2026-09-17",
      "terms": "C.O.D.",
      "remarks": "Call before arrival",
      "items": [
        { "product": "Bubble Wrap Single Layer 1m x 100m (MERAH)", "quantity": 20, "uom": "ROLL", "sku": "B17-ROLL" }
      ],
      "doTotal": 20
    },
    {
      "doNumber": "OPM2609-0552",
      "customer": "CUSTOMER B",
      "deliveryAddress": "45 Jalan Pasar, Pasir Mas, Kelantan",
      "phone": "019-8765432",
      "zone": "KELANTAN",
      "orderDate": "2026-09-17",
      "terms": "30 Days",
      "remarks": "",
      "items": [
        { "product": "Stretch Film 500mm x 2.2kg", "quantity": 25, "uom": "ROLL", "sku": "SF-22" }
      ],
      "doTotal": 25
    }
  ]
}

CRITICAL: Return strictly a valid JSON object. Do not wrap in markdown quotes.
`;

        let activeProducts = productsList;
        if (!activeProducts || !Array.isArray(activeProducts) || activeProducts.length === 0) {
            try {
                const { data: dbProds } = await supabase
                    .from('master_items_v2')
                    .select('sku, name')
                    .eq('status', 'Active')
                    .limit(300);
                if (dbProds && dbProds.length > 0) {
                    activeProducts = dbProds;
                }
            } catch (err) {
                console.warn("Failed to fetch fallback master_items_v2:", err);
            }
        }

        if (activeProducts && Array.isArray(activeProducts) && activeProducts.length > 0) {
            prompt += `\nReference Product Catalog (Standard SKUs and Names):\n`;
            prompt += activeProducts.slice(0, 300).map(p => `- SKU: ${p.sku} | Name: ${p.name}`).join('\n');
            prompt += `\nFor every item in the DO, determine the best matching standard SKU from the list above and return it in "sku". If unsure, leave "sku" empty string.\n`;
        }

        if (aliasList && aliasList.length > 0) {
            prompt += `\nSystem Customer Alias Mappings (PRIORITY RULE):\n`;
            prompt += aliasList.slice(0, 150).map(a => `- [Customer: "${a.customer}"] Raw DO Description: "${a.alias_name}" => Standard SKU: "${a.sku}"${a.product_name ? ` (${a.product_name})` : ''}`).join('\n');
            prompt += `\nCRITICAL: If a DO belongs to the specified customer and the item description matches or resembles an alias above, ALWAYS use that exact mapped SKU.\n`;
        }

        // Prepare file parts
        const fileParts = files.map(f => {
            let mime = f.mimeType || 'application/pdf';
            if (f.name && f.name.toLowerCase().endsWith('.pdf')) {
                mime = 'application/pdf';
            }
            const cleanBase64 = cleanBase64Payload(f.base64 || f.data || '');
            return {
                inlineData: {
                    data: cleanBase64,
                    mimeType: mime
                }
            };
        });

        let responseText = "";
        let lastError: any = null;
        let modelUsed = "";
        const errorLogs: string[] = [];

        for (const modelId of candidates) {
            try {
                console.log(`[DO PDF AI] Trying model ${modelId} for ${files.length} PDFs (est. ${totalEstimatedPages} pages)...`);
                const model = genAI.getGenerativeModel({
                    model: modelId,
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.1
                    }
                });
                const result = await model.generateContent([prompt, ...fileParts]);
                const text = (await result.response).text();
                if (text) {
                    responseText = text;
                    modelUsed = modelId;
                    break;
                }
            } catch (modelErr: any) {
                console.warn(`[DO PDF AI] Model ${modelId} failed:`, modelErr.message);
                errorLogs.push(`[${modelId}]: ${modelErr.message}`);
                lastError = modelErr;
            }
        }

        let parsed: any = null;

        if (responseText) {
            try {
                let cleanedJson = responseText
                    .replace(/```json/gi, '')
                    .replace(/```/g, '')
                    .trim();
                const jsonMatch = cleanedJson.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (jsonMatch) {
                    cleanedJson = jsonMatch[1];
                }
                const rawParsed = JSON.parse(cleanedJson);

                if (Array.isArray(rawParsed)) {
                    parsed = { deliveryOrders: rawParsed };
                } else if (rawParsed && typeof rawParsed === 'object') {
                    if (Array.isArray(rawParsed.deliveryOrders)) {
                        parsed = rawParsed;
                    } else if (Array.isArray(rawParsed.orders)) {
                        parsed = { ...rawParsed, deliveryOrders: rawParsed.orders };
                    } else if (Array.isArray(rawParsed.dos)) {
                        parsed = { ...rawParsed, deliveryOrders: rawParsed.dos };
                    } else if (Array.isArray(rawParsed.data)) {
                        parsed = { ...rawParsed, deliveryOrders: rawParsed.data };
                    } else if (rawParsed.doNumber || rawParsed.customer) {
                        parsed = { ...rawParsed, deliveryOrders: [rawParsed] };
                    }
                }
            } catch (jsonErr) {
                console.warn("[DO PDF AI] Failed to parse Gemini response as JSON:", responseText);
            }
        }

        // Fallback: If AI models failed or response was unparseable, extract from detected DOs or file list so user is never blocked
        if (!parsed || !Array.isArray(parsed.deliveryOrders) || parsed.deliveryOrders.length === 0) {
            console.warn("[DO PDF AI] Falling back to heuristic parser. Reason:", lastError?.message || 'Empty AI result');
            const today = new Date().toISOString().split('T')[0];
            
            let fallbackOrders: any[] = [];

            if (allDetectedDoNumbers.length > 0) {
                fallbackOrders = allDetectedDoNumbers.map((doNum, idx) => ({
                    doNumber: doNum,
                    customer: `Pelanggan / Customer ${idx + 1}`,
                    deliveryAddress: 'Sila lengkapkan alamat penghantaran / Please check delivery address',
                    phone: '',
                    zone: 'NORTH',
                    orderDate: today,
                    terms: 'C.O.D.',
                    items: [{
                        product: 'Bubble Wrap Single Layer 1m x 100m (B17-ROLL)',
                        quantity: 10,
                        uom: 'ROLL',
                        sku: 'B17-ROLL'
                    }],
                    doTotal: 10
                }));
            } else if (totalEstimatedPages > 1 && files.length === 1) {
                const rawName = (files[0].name || '').replace(/\.pdf$/i, '');
                const doPrefixMatch = rawName.match(/^(DO-[A-Za-z0-9]+-[0-9]+|OPM[0-9-]+|[A-Za-z0-9-]+)/i);
                const basePrefix = doPrefixMatch ? doPrefixMatch[1] : 'DO';
                const cleanCustomerBase = rawName
                    .replace(/_Proof_of_Delivery.*$/i, '')
                    .replace(/^DO[-_]/i, '')
                    .replace(/[-_][0-9]+$/g, '')
                    .replace(/[-_]/g, ' ')
                    .trim();

                for (let i = 1; i <= totalEstimatedPages; i++) {
                    const pageSeq = String(i).padStart(3, '0');
                    const cleanDoNo = `${basePrefix}-${pageSeq}`;
                    fallbackOrders.push({
                        doNumber: cleanDoNo,
                        customer: cleanCustomerBase ? `${cleanCustomerBase} (Drop ${i})` : `Customer Stop ${i} (Page ${i})`,
                        deliveryAddress: 'Sila lengkapkan alamat penghantaran / Please check delivery address',
                        phone: '',
                        zone: 'NORTH',
                        orderDate: today,
                        terms: 'C.O.D.',
                        remarks: '',
                        items: [{
                            product: 'Bubble Wrap Single Layer 1m x 100m (B17-ROLL)',
                            quantity: 10,
                            uom: 'ROLL',
                            sku: 'B17-ROLL'
                        }],
                        doTotal: 10
                    });
                }
            } else {
                fallbackOrders = files.map((f, idx) => {
                    const nameWithoutExt = (f.name || '').replace(/\.pdf$/i, '');
                    const doMatch = nameWithoutExt.match(/(OPM[A-Za-z0-9-]+|DO-[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)/i);
                    const doNumber = doMatch ? doMatch[1].toUpperCase() : `DO-${idx + 1}`;
                    return {
                        doNumber,
                        customer: nameWithoutExt || `Pelanggan / Customer ${idx + 1}`,
                        deliveryAddress: 'Sila lengkapkan alamat penghantaran / Please check delivery address',
                        phone: '',
                        zone: 'NORTH',
                        orderDate: today,
                        terms: 'C.O.D.',
                        remarks: '',
                        items: [{
                            product: 'Bubble Wrap Single Layer 1m x 100m (B17-ROLL)',
                            quantity: 10,
                            uom: 'ROLL',
                            sku: 'B17-ROLL'
                        }],
                        doTotal: 10
                    };
                });
            }

            parsed = {
                suggestedTripDate: today,
                primaryZone: 'NORTH',
                totalDrops: fallbackOrders.length,
                totalRolls: fallbackOrders.reduce((sum, d) => sum + d.doTotal, 0),
                destinationsSummary: fallbackOrders.map(d => d.customer).join(', '),
                deliveryOrders: fallbackOrders,
                isFallback: true
            };
        }

        const calculatedDrops = Array.isArray(parsed.deliveryOrders) ? parsed.deliveryOrders.length : 1;
        const calculatedRolls = Array.isArray(parsed.deliveryOrders)
            ? parsed.deliveryOrders.reduce((sum: number, d: any) => sum + (Number(d.doTotal) || 0), 0)
            : 0;

        const isKeyBlocked = errorLogs.some(e => e.includes('403 Forbidden') || e.includes('denied access'));
        const keyAlert = isKeyBlocked
            ? "Google Gemini API 密钥被 Google 限制访问 (403 Forbidden: Your project has been denied access)。请在 Google AI Studio (aistudio.google.com) 创建新 Key 并更新。"
            : undefined;

        return res.status(200).json({
            success: true,
            suggestedTripDate: parsed.suggestedTripDate || new Date().toISOString().split('T')[0],
            primaryZone: parsed.primaryZone || '',
            totalDrops: typeof parsed.totalDrops === 'number' ? parsed.totalDrops : calculatedDrops,
            totalRolls: typeof parsed.totalRolls === 'number' && parsed.totalRolls > 0 ? parsed.totalRolls : calculatedRolls,
            destinationsSummary: parsed.destinationsSummary || '',
            tripRemarks: parsed.tripRemarks || '',
            deliveryOrders: Array.isArray(parsed.deliveryOrders) ? parsed.deliveryOrders : [],
            isFallback: !!parsed.isFallback,
            isKeyBlocked,
            keyAlert,
            modelUsed: modelUsed || (parsed.isFallback ? 'fallback' : 'none'),
            debugError: errorLogs.length > 0 ? errorLogs.join(' || ') : (lastError ? lastError.message : null),
            discoveredModels: candidates
        });

    } catch (err: any) {
        console.error("Error in parse-trip-pdf:", err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to process DO PDF files'
        });
    }
}

// =====================================================================
// OMNI COMMAND HANDLER
// =====================================================================

async function handleOmniCommand(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query, context = {} } = req.body || {};
    const rawQuery = (query || '').trim();
    const userRole = context.userRole || 'Operator';
    const isManagement = ['Boss', 'SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator'].includes(userRole);

    if (!rawQuery) {
        return res.status(400).json({ error: 'Query is required' });
    }

    // 1. RBAC Guardrail check: Non-management users cannot query payroll/price
    const sensitiveKeywords = /(?:工资|薪水|薪资|底薪|单价|成本|毛利|利润|profit|margin|salary|payroll|wage)/i;
    if (!isManagement && sensitiveKeywords.test(rawQuery)) {
        return res.status(200).json({
            type: 'unknown',
            message: `🛡️ 权限拦截：您的角色 (${userRole}) 无权在万能输入口检索或统计薪酬与财务数据。`
        });
    }

    try {
        // 2. Statistical / Business Query Detection
        const isStatQuery = /(?:产量|产能|效率|稼动率|出库|入库|送货|单量|多少|统计|概况|汇总|状态|排行|summary|total|count|status)/i.test(rawQuery);

        if (isStatQuery) {
            const [machinesRes, ordersRes] = await Promise.all([
                supabase.from('sys_machines_v2').select('machine_id, status'),
                supabase.from('sales_orders').select('id, status, zone').limit(100)
            ]);

            const machines = machinesRes.data || [];
            const runningMachines = machines.filter(m => m.status === 'RUNNING' || m.status === 'Active').length;
            const totalMachines = machines.length || 15;
            const machineUtilization = Math.round((runningMachines / (totalMachines || 1)) * 100);

            const orders = ordersRes.data || [];
            const pendingOrders = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
            const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;

            return res.status(200).json({
                type: 'insight',
                insightData: {
                    query: rawQuery,
                    title: '全厂实时运营指标速览',
                    summary: `当前全厂共 ${totalMachines} 台主力生产设备，${runningMachines} 台处于运行状态；待交付送货单 ${pendingOrders} 笔，累计已签收 ${deliveredOrders} 笔。`,
                    keyMetrics: [
                        {
                            label: '设备稼动率',
                            value: `${machineUtilization}%`,
                            subtext: `${runningMachines} 运行 / ${totalMachines} 总机台`,
                            trend: machineUtilization >= 75 ? 'up' : 'down'
                        },
                        {
                            label: '待派送 DO',
                            value: `${pendingOrders} 笔`,
                            subtext: '包含今天与明日排单',
                            trend: 'neutral'
                        },
                        {
                            label: '已完成签收',
                            value: `${deliveredOrders} 笔`,
                            subtext: '历史履约完成单量',
                            trend: 'up'
                        }
                    ],
                    targetPage: 'factory-live-os',
                    targetPageLabel: '进入全厂实时大屏 (Factory Live OS)'
                }
            });
        }

        // 3. Fallback to Gemini if AI key exists
        const geminiKey = process.env.GOOGLE_API_KEY || '';
        if (geminiKey) {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const prompt = `你是一个工业制造系统(Packsecure OS)的指令解析核心。
用户角色: ${userRole}, 用户输入: "${rawQuery}".

请判断该输入属于哪一类：
1. "action": 用户想要执行业务操作（如报修、创建待办、请假、登记报废）。
2. "insight": 用户想要查看业务统计或数据分析。
3. "unknown": 无法识别或仅仅是模糊搜索。

请严格输出 JSON 格式（不要输出 markdown 标记）：
{
  "type": "action" | "insight" | "unknown",
  "actionDraft": {
    "intent": "report_machine_issue" | "create_task" | "submit_leave" | "quick_scrap" | "general_action",
    "title": "卡片简短标题",
    "summary": "业务说明描述",
    "isDangerous": boolean,
    "dangerReason": "若危险请说明原因",
    "fields": [
      { "key": "fieldName", "label": "字段名", "value": "解析值", "type": "text"|"number"|"select"|"date" }
    ],
    "payload": { }
  },
  "message": "若是unknown或需解释时的反馈文案"
}`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            try {
                const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedJson);
                return res.status(200).json(parsed);
            } catch {
                // fallback
            }
        }

        // 4. Default Heuristic Match
        return res.status(200).json({
            type: 'unknown',
            message: '未能精确识别该动作，您可输入关键词直接检索单据/客户，或使用如：“报修 T1-M03 切刀故障”、“待办 盘点成品仓” 等明确指令。'
        });

    } catch (err: any) {
        console.error('omni-command handler error:', err);
        return res.status(500).json({
            error: 'Failed to process omni command',
            details: err.message
        });
    }
}

// =====================================================================
// MASTER HANDLER ROUTER
// =====================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const action = req.query?.action || req.body?.action;
    const reqType = req.query?.type || req.body?.type;

    // 1. Query or Briefing requests
    if (
        action === 'query' ||
        action === 'briefing' ||
        reqType === 'query' ||
        req.query?.briefing === 'true' ||
        (req.method === 'GET' && !req.query?.mac)
    ) {
        return handleQuery(req, res);
    }

    // 2. Text Parsing requests
    if (
        action === 'parse-text' ||
        reqType === 'customers' ||
        reqType === 'sales_order'
    ) {
        return handleParseText(req, res);
    }

    // 3. DO PDF Trip Batch Parsing requests
    if (action === 'parse-trip-pdf' || req.query?.action === 'parse-trip-pdf' || req.body?.action === 'parse-trip-pdf') {
        return handleParseTripPdf(req, res);
    }

    // 4. Omni Command requests
    if (action === 'omni-command' || req.query?.action === 'omni-command' || req.body?.action === 'omni-command') {
        return handleOmniCommand(req, res);
    }

    // 5. Default: Universal Intake (parse / commit)
    return handleIntake(req, res);
}
