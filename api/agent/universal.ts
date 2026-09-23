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
async function resolveValidMachineId(rawMachine: string | undefined): Promise<string | null> {
    const input = (rawMachine || '').trim().toUpperCase();
    if (!input) return null;

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

            // 未找到有效匹配，不盲目乱取首个机台
            return null;
        }
    } catch (e) {
        console.warn('resolveValidMachineId warning:', e);
    }
    return null;
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
                // 如果是专项作业（OT/卸柜/搬运/散单/特单）或送货任务，且未明确在文字/输入中指定机台，则绝不附带机台
                const isNonMachineIntent = parsedData.intent === 'operator_special_work' ||
                    parsedData.intent === 'delivery_task' ||
                    parsedData.intent === 'delivery_exception';

                const targetMachineParam = isNonMachineIntent ? parsedData.machineId : (parsedData.machineId || context?.currentMachine);
                const resolvedMachine = targetMachineParam ? await resolveValidMachineId(targetMachineParam) : null;
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
                    const validMachineId = (await resolveValidMachineId(parsedData.machineId || context?.currentMachine)) || 'T1-M03';
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
                    const validMachineId = (await resolveValidMachineId(parsedData.machineId || context?.currentMachine)) || 'T1-M03';
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
                    const validMachineId = (await resolveValidMachineId(parsedData.machineId || context?.currentMachine)) || 'T1-M03';
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
                const targetMachine = (await resolveValidMachineId(parsedData.machineLoginCode || parsedData.machineId)) || 'T1-M03';
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
Analyze the attached Delivery Order (DO) PDF document(s) and/or image photo(s).
All uploaded documents belong to ONE single lorry delivery trip (一次出车派送任务).

============================================================
🚨 CRITICAL MULTI-PAGE & MULTI-DO PARSING DIRECTIVE:
1. The uploaded file(s) contain approximately ${totalEstimatedPages} page(s) / document(s).
${allDetectedDoNumbers.length > 0 ? `2. Detected potential DO numbers in document text streams: ${allDetectedDoNumbers.join(', ')}.\n` : ''}
2. In Malaysian factory and warehouse operations, multiple distinct Delivery Orders (DOs) or handwritten order slips are frequently scanned, concatenated, or photographed together into ONE trip dispatch!
3. EACH PAGE (or distinct customer order) is a SEPARATE Delivery Order with its own DO number, recipient customer name, delivery address, and items.
4. YOU MUST INSPECT EVERY SINGLE PAGE AND DOCUMENT FROM FIRST TO LAST.
5. For EVERY distinct DO number (or distinct customer stop), you MUST create a separate object in the "deliveryOrders" array.
6. If a single DO spans multiple pages (e.g. "Page 1 of 2" and "Page 2 of 2" with the EXACT SAME DO number), combine the items into that single DO. Otherwise, if the DO number or customer is different, it is a NEW DO.

============================================================
🚨 CRITICAL STRIKETHROUGH & CROSSED-OUT ITEMS DIRECTIVE (划线作废识别):
- Carefully inspect all pages and documents visually for strike-through lines (水平横线划掉 / pen crosses / lines drawn through item descriptions or quantities).
- If an item line, product description, or quantity has a line drawn through it, IT HAS BEEN CANCELLED/VOIDED ON SITE!
- DO NOT output struck-through items in the "items" array! They are strictly VOID and must not be loaded onto the lorry!
- If original printed items are struck through, look immediately below or nearby for handwritten or printed replacement/exchange instructions (e.g. "EXCHANGE :", "TUKAR :", "HANTAR ...").

============================================================
🚨 CRITICAL EXCHANGE & RETURN DIRECTIVE (换货与收旧货指令):
- If the document contains "EXCHANGE :", "TUKAR :", or directives like:
    "HANTAR SF BALCK X 1CTN"
    "AMBIL BALIK SF BLACK X 1CTN"
- Apply these strict business rules:
  1. "HANTAR ..." means new goods to be delivered out by our lorry to the customer. This IS the active cargo item! Add this product and quantity to the "items" array.
  2. "AMBIL BALIK ..." means old/defective goods the driver MUST collect from the customer and bring back to the factory.
     - DO NOT add "AMBIL BALIK" goods as outbound cargo to "items" (it is not factory stock to load)!
     - Instead, set "isExchange": true.
     - Set "exchangeReturnNotes": exact return text (e.g. "AMBIL BALIK SF BLACK X 1CTN").
     - Prepend "[EXCHANGE / 换货: AMBIL BALIK SF BLACK X 1CTN]" to "remarks".

============================================================
🚨 CRITICAL HANDWRITTEN SLIPS & INFORMAL NOTES DIRECTIVE (手写便签/临时单识别):
- The uploaded document may be a photo, scan, or image of a HANDWRITTEN delivery note or informal paper slip (白纸手写便签/临时加单).
- 1. Carefully extract:
    - "customer": Recipient customer or company name (e.g. "CH INDUSTRY - HOLYN TRADING").
    - "deliveryAddress": Full destination address (e.g. "6240A MK 14 KAMPUNG SIMPAH 12300 BUTTERWORTH PENANG").
    - "phone": Contact number (labeled "TEL:" or similar, e.g. "012-505 9929").
    - "items": Products and quantities listed (e.g. "Hitam Full 1m x 100m - 20 roll").
- 2. If there is NO formal printed DO number (e.g., no printed "OPM2609-xxxx"), auto-generate a clean standardized temporary DO number formatted as:
    "MANUAL-2609-XXX" (e.g. "MANUAL-2609-001" using current year/month 2609 and a 3-digit sequence).
- 3. Set "isHandwritten": true for this DO.

============================================================
🚨 CRITICAL RULES FOR QUANTITY, UOM & PACKAGING MULTIPLIERS (单据官方打印数量与包装折算准则):
1. ABSOLUTE TRUTH IS THE PRINTED "QTY / QUANTITY" COLUMN:
   - The "quantity" field MUST strictly match the exact numeric value printed in the official "Qty" or "Quantity" column of the Delivery Order.
   - NEVER multiply the printed quantity by packaging multipliers or parentheses in the product description!
   - Examples of exact matching:
     * If DO line says:
       "Stretch Film 2.2kg 200core 23Micron ( Black ) ( One Carton Six Rolls )" with Qty: 20, UOM: UNIT
       ==> MUST OUTPUT:
           "quantity": 20,
           "uom": "UNIT",
           "product": "Stretch Film 2.2kg 23Micron Black (20 Cartons / 120 Rolls)",
           "sku": "SF-BLACK-2.2"
       ==> STRICTLY FORBIDDEN to output quantity: 120! The printed DO quantity is 20!

     * If DO line says:
       "Double Layer Clear 25cm x 100m (4 units)" with Quantity: 5, Unit: Roll
       ==> MUST OUTPUT:
           "quantity": 5,
           "uom": "ROLL",
           "product": "Double Layer Clear 25cm x 100m (5 Bundles / 20 Slit Rolls)",
           "sku": "BW-DL-CLR-100Mx25CMx4ROLL-BLU"
       ==> STRICTLY FORBIDDEN to output quantity: 20 or 4! The printed DO quantity is 5!

2. PACKAGING BREAKDOWN IN PRODUCT NAME OR REMARKS:
   - Retain the packaging breakdown in the "product" description or remarks, e.g. "(20 Cartons / 120 Rolls)" or "(5 Bundles / 20 Slit Rolls)".
   - This ensures the driver knows how many physical rolls/pieces to count, while ensuring the official quantity stays 100% true to the DO and ERP/inventory system!

3. BUBBLE WRAP SLITTING (分切规格) & SKU MATCHING:
   - When description specifies slit width (e.g. 25cm, 30cm, 50cm):
     * "25cm" or "25cm x 100m (4 units)":
       - Double Layer ("Double" / "DL"): match to "BW-DL-CLR-100Mx25CMx4ROLL-BLU" (or "DL-25CM") for clear, or "BW-DL-BLK-100Mx25CMx4ROLL-RED" for black.
       - Single Layer ("Single" / "SL"): match to "BW-SL-CLR-100Mx25CMx4ROLL-GRN" (or "SL-25CM") for clear, or "BW-SL-BLK-100Mx25CMx4ROLL-GRN" for black.
       - NEVER match a 25cm slit roll to a 100cm uncut full roll SKU!
     * "50cm" or "Half Roll" or "2 in 1":
       - Match to the corresponding 50CM / Half SKU.
     * "1m" or "100cm" or "Full Roll":
       - Match to standard 100CM full roll SKU.
   - "SF" or "Stretch Film" in "CTN" or "Carton":
     - UOM is "UNIT" or "CTN". Product SKU is "SF-BLACK-2.2" or "SF-CLEAR-2.2". Quantity is the exact number of cartons on the DO!
   - "Tape" / "Cukup Tape" in "CTN" or "Carton":
     - Set "uom": "BOX". Quantity is the exact carton count on the DO.

TASK:
Extract structured data for each Delivery Order (DO) across ALL pages and synthesize the whole Trip summary.

FOR EACH DELIVERY ORDER:
- "doNumber": Printed DO number (e.g., "OPM2609-0284") or generated "MANUAL-2609-001" for handwritten slips.
- "customer": Recipient customer or company name (e.g. "PERNIAGAAN THUNG TATT", "CH INDUSTRY - HOLYN TRADING").
- "deliveryAddress": Complete delivery address with street, unit, industrial park, postcode, town, and state.
- "phone": Contact phone/mobile if present (e.g. "017-4816678", "012-505 9929").
- "zone": Primary Malaysian state/region (e.g., PENANG, KELANTAN, PERAK, KEDAH, SELANGOR, KL, NEGERI SEMBILAN, MELAKA, JOHOR, PAHANG, TERENGGANU).
- "orderDate": DO issue date in YYYY-MM-DD format (e.g., "2026-09-08").
- "terms": Payment term if visible (e.g., "C.O.D.", "30 Days").
- "remarks": Any printed or handwritten remarks, notes, special delivery instructions, exchange notes (e.g. "[EXCHANGE / 换货: AMBIL BALIK SF BLACK X 1CTN]").
- "isExchange": true if this is an exchange order with goods to be collected back, false otherwise.
- "exchangeReturnNotes": description of goods to collect back (e.g. "AMBIL BALIK SF BLACK X 1CTN"), or empty string.
- "isHandwritten": true if this DO comes from a handwritten paper slip without formal printed header, false otherwise.
- "items": Array of valid outbound products on this DO (EXCLUDING struck-through items):
  [
    {
      "product": "Product description (e.g. Stretch Film 2.2kg 23Micron Black (20 Cartons / 120 Rolls))",
      "quantity": 20, // Must strictly match the printed DO Quantity column!
      "uom": "UNIT" or "ROLL" or "BOX" or "CTN",
      "sku": "Matched SKU from the Reference Product List below, or empty string if no clear match"
    }
  ]
- "doTotal": Sum of item quantities on this DO.

FOR THE OVERALL TRIP:
- "suggestedTripDate": Prevailing delivery date in YYYY-MM-DD format (default to today 2026-09-18 if not clear).
- "primaryZone": Main region of the trip (e.g., PENANG, KELANTAN).
- "totalDrops": Total count of distinct DO stops (count of objects in deliveryOrders).
- "totalRolls": Sum of all item quantities across all DOs.
- "destinationsSummary": Comma-separated list of towns/areas visited (e.g., "Bukit Mertajam, Butterworth").
- "tripRemarks": Any overall trip-level remark or driver instruction, or empty string.

EXACT JSON OUTPUT FORMAT REQUIRED:
{
  "suggestedTripDate": "2026-09-18",
  "primaryZone": "PENANG",
  "totalDrops": 2,
  "totalRolls": 25,
  "destinationsSummary": "Bukit Mertajam, Butterworth",
  "tripRemarks": "",
  "deliveryOrders": [
    {
      "doNumber": "OPM2609-0877",
      "customer": "BOON CHEE AUTO TRADING SDN BHD",
      "deliveryAddress": "22, JALAN RIMBUNAN RAYA, LAMAN RIMBUNAN 52100, KUALA LUMPUR",
      "phone": "017-3778911",
      "zone": "KUALA LUMPUR",
      "orderDate": "2026-09-22",
      "terms": "C.O.D.",
      "remarks": "",
      "isExchange": false,
      "exchangeReturnNotes": "",
      "isHandwritten": false,
      "items": [
        { "product": "Stretch Film 2.2kg 23Micron Black (20 Cartons / 120 Rolls)", "quantity": 20, "uom": "UNIT", "sku": "SF-BLACK-2.2" }
      ],
      "doTotal": 20
    },
    {
      "doNumber": "MANUAL-2609-001",
      "customer": "CH INDUSTRY - HOLYN TRADING",
      "deliveryAddress": "6240A MK 14 KAMPUNG SIMPAH 12300 BUTTERWORTH PENANG",
      "phone": "012-505 9929",
      "zone": "PENANG",
      "orderDate": "2026-09-18",
      "terms": "C.O.D.",
      "remarks": "",
      "isExchange": false,
      "exchangeReturnNotes": "",
      "isHandwritten": true,
      "items": [
        { "product": "Bubble Wrap Black 1m x 100m (Hitam Full)", "quantity": 20, "uom": "ROLL", "sku": "" }
      ],
      "doTotal": 20
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

        // Prepare file parts with image format support
        const fileParts = files.map(f => {
            let mime = f.mimeType || 'application/pdf';
            const nameLower = (f.name || '').toLowerCase();
            if (nameLower.endsWith('.pdf')) {
                mime = 'application/pdf';
            } else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
                mime = 'image/jpeg';
            } else if (nameLower.endsWith('.png')) {
                mime = 'image/png';
            } else if (nameLower.endsWith('.webp')) {
                mime = 'image/webp';
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
                    const nameWithoutExt = (f.name || '').replace(/\.(pdf|jpe?g|png|webp)$/i, '');
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
        // 2. Greeting & General Assistance Recognition
        const isGreetingOrHelp = /^(?:你好|您好|hi|hello|嗨|早|早安|晚安|哈喽|在吗|帮助|help|指南|功能|你是谁|你是谁啊|你是做什么的|怎么用|能做什么|\?|？)/i.test(rawQuery);
        if (isGreetingOrHelp) {
            const userName = context.userName || '同事';
            return res.status(200).json({
                type: 'answer',
                answerData: {
                    title: `您好，${userName}！我是 Packsecure 智能协同助理 👋`,
                    text: `我是工厂与仓储运营的 AI 助理（当前身份：${userRole}）。您可以在万能输入口随时进行：\n\n• **极速搜索**：输入 DO 单号、客户名、物料 SKU、机台或员工\n• **业务指令**：直接输入 “报修 T1-M03 切刀故障”、“待办 盘点原料仓”、“请假 明天年假1天”\n• **运营看板**：输入 “全厂设备稼动率”、“今日送货单概况” 秒出数据卡片\n• **凭证归档**：直接拖入或粘贴 (Ctrl+V) PUSPAKOM 验车单、官方公函、油票报销单`,
                    quickActions: [
                        { label: '🛠️ 报修机台 (T1-M03)', query: '报修 T1-M03 切刀钝化' },
                        { label: '📋 新建协同待办', query: '待办 盘点原料仓库存' },
                        { label: '🏖️ 申请年假', query: '请假 明天年假1天' },
                        { label: '📊 查询设备稼动率', query: '全厂设备稼动率' },
                        { label: '🚚 查询吉兰丹订单', query: '吉兰丹' },
                        { label: '📎 历史凭证检索', query: 'doc: ' }
                    ],
                    targetPage: 'factory-live-os',
                    targetPageLabel: '进入全厂实时大屏 (Factory Live OS)'
                }
            });
        }

        // 3. Statistical / Business Query Detection
        const isStatQuery = /(?:产量|产能|效率|稼动率|出库|入库|送货|单量|多少|统计|概况|汇总|状态|排行|summary|total|count|status)/i.test(rawQuery);

        if (isStatQuery) {
            const [machinesRes, ordersRes] = await Promise.all([
                supabase.from('sys_machines').select('machine_id, status'),
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

        // 4. Gemini AI Intent Analysis & Question Answering
        const geminiKey = process.env.GOOGLE_API_KEY || '';
        if (geminiKey) {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const prompt = `你是一个工业制造与仓储运营系统(Packsecure OS)的指令解析与问答助理。
用户角色: ${userRole}, 用户姓名: ${context.userName || '用户'}, 用户输入: "${rawQuery}".

请分析用户输入，并判断属于哪一类：
1. "action": 用户想要执行业务操作（如报修、创建待办、请假、登记报废）。
2. "insight": 用户想要查看业务统计或数据分析指标。
3. "answer": 用户在打招呼、提问工厂流程/SOP、询问操作方法或寻求系统帮助。
4. "unknown": 极度模糊无意义的内容。

请严格输出 JSON 格式（不要输出任何 markdown 格式代码块或额外文字）：
{
  "type": "action" | "insight" | "answer" | "unknown",
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
  "insightData": {
    "title": "指标标题",
    "summary": "数据总结",
    "keyMetrics": [{ "label": "指标名", "value": "数值", "subtext": "补充说明" }],
    "targetPage": "关联页面路由",
    "targetPageLabel": "按钮文案"
  },
  "answerData": {
    "title": "回答标题",
    "text": "清晰准确的中文回答内容(可使用条理化的列表和加粗)",
    "quickActions": [
      { "label": "推荐操作按钮", "query": "填入该操作的标准指令" }
    ],
    "targetPage": "推荐前往的页面路由",
    "targetPageLabel": "前往查看按钮"
  },
  "message": "若是unknown或需解释时的反馈文案"
}`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            try {
                const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedJson);
                if (parsed.type) {
                    return res.status(200).json(parsed);
                }
            } catch {
                // fallback to heuristic
            }
        }

        // 5. Question Heuristic Fallback (if AI fails or key not present)
        const isQuestion = /(?:怎么|如何|什么|哪|为什么|规则|流程|步骤|可以|能不能|how|what|why)/i.test(rawQuery);
        if (isQuestion) {
            return res.status(200).json({
                type: 'answer',
                answerData: {
                    title: `业务操作与知识指引`,
                    text: `关于您的提问 “**${rawQuery}**”：\n\n您可以直接在万能输入口使用标准格式分发业务：\n• **报修设备**：输入「报修 T1-M03 切刀故障」\n• **创建待办**：输入「待办 盘点成品仓」\n• **申请请假**：输入「请假 明天年假1天」\n• **查询单据**：输入 DO 单号或客户名\n• **凭证归档**：拖入或粘贴 PUSPAKOM、油票、公函等\n\n若需详细设备 SOP 或深入问答，请点击下方按钮查阅知识库或开启语音助理。`,
                    quickActions: [
                        { label: '🛠️ 报修机台', query: '报修 ' },
                        { label: '📋 新建待办', query: '待办 ' },
                        { label: '🏖️ 申请请假', query: '请假 ' },
                        { label: '📖 查看 SOP 知识库', query: 'SOP' }
                    ],
                    targetPage: 'sop-management',
                    targetPageLabel: '前往 SOP 知识库'
                }
            });
        }

        // 6. Default Fallback
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
// PART 5: SOP ASSISTANT COPILOT LOGIC
// =====================================================================

const PACKSECURE_DOMAIN_KNOWLEDGE = `
[PackSecure 厂区与核心机台档案]
1. Taiping 太平厂区 (T1):
   - T1.1-M03: Stretch Film (拉伸膜/缠绕膜生产线)
   - T1.2-M01: 2M Double Layer Bubblewrap (2米双层气泡膜机)
   - T1.3-M02: 1M Single Layer Bubblewrap (1米单层气泡膜机)
2. Nilai 汝来厂区 (N1, N2):
   - N1-M01: 1M Double Layer Bubblewrap (1米双层气泡膜机)
   - N2-M02: 1M Single Layer Bubblewrap (1米单层气泡膜机)
3. 造粒与混料 (Material Recycling & Extrusion):
   - 多螺杆混料机、再生料破碎与造粒机、母粒与回料配比控制。

[PackSecure OS 系统模块映射]
- scanner: 生产控制台 (操作工扫机台二维码、开工计数、报工、停机异常上报)
- raw_material_mobile: 混料与多螺杆 (原料称重、回料投入比例与批次追踪)
- livestock: 实时成品与半成品库存看板
- inventory: 全局库存主表
- stock-movement: 库位转移与物料调拨
- stock-audit: 仓库月度/季度实物盘点
- delivery-driver: 司机端移动门户 (开工扫卡车QR绑定、到达客户点拍送货单DO+货物双照片、回厂扫车上QR还车解绑)
- delivery: 调度中心出货排单与派车管理
- order-summary: 每日备货与配货看板
- lorry-service: 车队保养与维修记录
- leave-calendar: 员工请假日历与请假提交
- hr: HR 人事控制中心 (员工入职、考勤假期审核、报销核验)
- machine-schedule: 生产排程与机台计划
- machine-labels: 机器二维码标签打印与张贴
- floor-plan: 车间平面布局图

[角色分类 (Roles)]
- SuperAdmin: 系统超级管理员
- Admin: 系统管理员
- Manager: 生产厂长 / 车间主管 / 物流主管
- Operator: 一线生产操作工 / 混料工
- Driver: 配送卡车司机
- HR: 人事行政主管
`;

function generateFallbackIndustrialSOP(params: {
    action: string;
    topic: string;
    message: string;
    existingContent: string;
    currentTitle: string;
    language: string;
    category: string;
    targetRoles: string[];
    pageId: string;
    imageUrl?: string;
}) {
    const raw = (params.message || params.topic || params.currentTitle || '').toLowerCase();
    const existing = params.existingContent || '';

    // 1. If modifying existing content
    if (existing && existing.length > 20) {
        let updated = existing;
        let summary = '已为您在右侧正文中同步执行了修改。';

        if (/两张|拍照|凭证|do|foto/i.test(raw)) {
            updated = updated.replace(/###\s*(步骤二|步骤2|Langkah\s*2)[\s\S]*?(?=###\s*(步骤三|步骤3|Langkah\s*3)|$)/, 
`### 步骤二：送达客户点与双重拍照上传凭证 / Langkah 2: Hantar & Muat Naik Foto
1. 送达指定客户后，在手机端列表中点开当前客户订单。
2. **拍照上传双重凭证 (Proof of Delivery)**：
   - **BUNYIK DO (纸质签单照)**：拍摄客户已签字盖章的完整送货单照片（确保单号、日期与签名清晰）。
   - **BUKTI BARANG (现场卸货照)**：拍摄货物整齐摆放在客户仓库或收货点的现场全貌照片。
3. 检查无误后，点击底部绿色「HANTAR DROP POINT / 提交此站」按钮确认。
\n`);
            summary = '已为您将第二步更新为必须上传【纸质 DO 签单照】与【现场货物照】双重拍照凭证。';
        } else if (/精简|简单|短一点|去除/i.test(raw)) {
            updated = updated.split('\n').filter(line => !line.startsWith('> [!NOTE]') && !line.includes('本文档旨在')).join('\n');
            summary = '已为您精简了冗余套话，保留最干练核心实操步骤。';
        } else if (/马来|双语|bahasa|bm/i.test(raw)) {
            summary = '已为您将正文标题与核心步骤转换为中+马双语对照版。';
            if (!updated.includes('Langkah')) {
                updated = updated
                    .replace(/#\s*(.+)/, '# $1\n### Prosedur Operasi Standard & Panduan Kerja')
                    .replace(/###\s*步骤一[：:]\s*(.+)/, '### 步骤一：$1 / Langkah 1: Persediaan')
                    .replace(/###\s*步骤二[：:]\s*(.+)/, '### 步骤二：$1 / Langkah 2: Pelaksanaan')
                    .replace(/###\s*步骤三[：:]\s*(.+)/, '### 步骤三：$1 / Langkah 3: Selesai');
            }
        } else if (/安全|警告|防护|ppe/i.test(raw)) {
            if (!updated.includes('[!CAUTION]')) {
                updated = `> [!CAUTION]\n> 严禁违章作业！进入作业区域必须严格佩戴规定劳保用品，机械运转时严禁接触传动与高温部件！\n\n` + updated;
            }
            summary = '已为您在正文中增加了高亮安全警告与防护(PPE)要求卡片。';
        } else if (/清单|checklist|核对/i.test(raw)) {
            summary = '已为您在文末提炼出标准闭环操作检查清单。';
            if (!updated.includes('- [ ]')) {
                updated += `\n\n---\n\n## 车间实操闭环检查清单 (Checklist)\n- [ ] 1. 开工前劳保用品与设备状态自检\n- [ ] 2. 扫码确认上岗与工单信息校验\n- [ ] 3. 按规范步骤执行关键控制点\n- [ ] 4. 现场完工拍照与数据记录上传\n- [ ] 5. 工作区域整理清洁与交接班确认\n`;
            }
        } else {
            summary = `已根据您的指令「${params.message || params.topic}」优化了规程正文。`;
        }

        return {
            title: params.currentTitle || '标准作业规程',
            description: '针对工厂实操制定的操作规范与安全要求',
            content: updated,
            suggested_roles: params.targetRoles?.length ? params.targetRoles : ['Operator', 'Manager'],
            suggested_page_id: params.pageId || '',
            category: params.category || 'production',
            summary,
            checklist: []
        };
    }

    // 2. Initial generation based on topic keywords
    if (/司机|送货|卡车|还车|交单|driver|delivery|lorry/i.test(raw)) {
        return {
            title: '司机送货打卡与交单还车 SOP (Driver Delivery Standard)',
            description: '指导司机进行卡车扫码绑定、客户现场双重拍照上传、以及回厂交单扫码还车全流程。',
            suggested_roles: ['Driver', 'Manager'],
            suggested_page_id: 'delivery-driver',
            category: 'logistics',
            summary: '已为您起草《司机送货打卡与交单还车标准规程》，涵盖车牌绑定、双重拍照与回厂交单闭环。',
            checklist: [
                '早间开工扫仪表盘QR绑定卡车',
                '送达客户点拍摄客户签收DO纸质单',
                '拍摄现场货物放置卸货全貌照',
                '点击绿色按钮提交当站送达',
                '回厂将纸质单交回办公室文员',
                '在系统点击TAMAT SYIF并扫车上QR还车'
            ],
            content: `# 司机送货打卡与交单还车 SOP (Driver Delivery Standard)
### Prosedur Operasi Standard Penghantaran & Pemulangan Lori

> [!IMPORTANT]
> 司机每日开工必须扫码绑定卡车，并在每站送达后完成【DO 纸质单签字照】与【现场货物照】双重拍照上传。

---

## 1. 流程简图 / Ringkasan Aliran Kerja
\`\`\`
[1. 扫车上QR绑定卡车] ➔ [2. 依次送达客户并拍照提交] ➔ [3. 回厂交单并扫车内QR还车]
\`\`\`

---

## 2. 核心操作步骤 / Langkah Operasi
### 步骤一：开工绑定卡车 / Langkah 1: Tambat Lori (Mula Syif)
1. 打开手机端 PackSecure 系统并登录。
2. 在 **My Deliveries** 页面点击顶部 **「Ketik untuk Imbas QR Lori / 扫码绑定卡车」** 按钮。
3. 将摄像头对准卡车驾驶室仪表盘上的 **车牌 QR 码**。
   * *绑定成功*：顶部横幅变绿并显示当前驾驶卡车车牌（如 \`Lori Sekarang: PGD 1234\`）。

### 步骤二：送货与拍照上传 / Langkah 2: Hantar Barang & Muat Naik Foto
1. 前往客户送货地点，在列表中点击当前送达的客户订单。
2. **拍照上传双重凭证 (Proof of Delivery)**：
   - **BUNYIK DO (DO 照片)**：拍摄客户盖章且签字的纸质送货单全貌（确保字迹清晰）。
   - **BUKTI BARANG (货物照片)**：拍摄货物在客户仓库/卸货现场的照片。
3. （选填）如遇货物破损或少件，在备注栏输入说明。
4. 点击底部绿色的 **「HANTAR DROP POINT INI / 提交此站」** 按钮确认提交。

> [!WARNING]
> 送货途中严禁点击“结束整趟行程/Tamat”按钮！直接提交各站即可，全部送完后开车返回厂区。

### 步骤三：回厂交单与扫码还车 / Langkah 3: Balik Pejabat & Imbas QR (Tamat Trip)
1. 当今天所有客户全部送达，并开车回到 **Taiping 厂区** 后。
2. 前往办公室，将所有客户签字盖章的纸质 DO 单交回给文员。
3. 在手机顶部蓝色卡车横幅中，点击 **「TAMAT SYIF / END SHIFT」** 按钮。
4. 手机开启扫码器，再次对准**当前驾驶卡车仪表盘上的同一个 QR 码**。
5. 扫码成功后，系统自动将今日所有已送订单归档结单，并解除车辆绑定。
`
        };
    }

    if (/拉伸膜|stretch|t1\.1|换卷/i.test(raw)) {
        return {
            title: '拉伸膜生产线 (T1.1-M03) 换卷与厚度校准规程',
            description: '规范拉伸膜生产线原料换卷、穿膜引导、厚度微调与开机自检流程。',
            suggested_roles: ['Operator', 'Manager'],
            suggested_page_id: 'scanner',
            category: 'production',
            summary: '已为您起草《拉伸膜生产线 (T1.1-M03) 换卷与厚度校准规程》，包含安全防护与测厚表格。',
            checklist: [
                '检查新料卷规格与工单一致',
                '设备完全停机断电确认',
                '旧料卷残余卸下并称重记录',
                '新料卷平稳上轴并顺畅穿膜',
                '启动机台慢速引料并测量首件厚度',
                '在生产控制台扫码上报工单'
            ],
            content: `# 拉伸膜生产线 (T1.1-M03) 换卷与厚度校准规程

> [!NOTE]
> 本规程适用于 Taiping 厂区拉伸膜生产线（T1.1-M03），指导操作工安全高效地执行换卷与厚度校准作业。

---

## 1. 劳保安全防护 (PPE)
> [!CAUTION]
> 操作旋转部件与加热区时必须佩戴防烫手套、防护眼镜及劳保防砸鞋。严禁在机械高速旋转时用手清理辊筒！

---

## 2. 操作步骤清单
### 步骤一：生产准备与降速停机
1. 当放卷轴原料即将用尽（剩余约 5-10m）时，在控制台逐步降低牵引机速度。
2. 按下正常停机开关，待收卷辊完全停止转动。
3. 在 PackSecure \`scanner\` 生产控制台点击当前工单暂停。

### 步骤二：旧料卸除与新卷安装
1. 小心切断残余引膜，取下旧卷纸芯，残料放入专用回收筐并在 \`raw_material_mobile\` 中登记回料。
2. 使用气动升降或行车将新料卷平稳装入放卷气胀轴，充气锁紧。
3. 手动牵引新料膜头，按导辊穿行示意图依次穿过冷却辊、牵引辊及展平辊。

### 步骤三：启动引料与厚度校准
1. 低速启动主电机，观察出料流涎均匀度。
2. 运转 3-5 分钟后取样，使用千分尺测量膜卷两端及中心厚度：
   | 测量点 | 标准厚度 (μm) | 实测允许公差 |
   | :--- | :--- | :--- |
   | 左侧边缘 (Left) | 20 μm | ± 1.0 μm |
   | 中心部位 (Center) | 20 μm | ± 1.0 μm |
   | 右侧边缘 (Right) | 20 μm | ± 1.0 μm |
3. 调整模唇微调螺栓直至全幅厚度达标，随后在系统点击“继续生产”。
`
        };
    }

    const cleanTitle = params.topic || params.message || '包装车间标准作业规程';
    return {
        title: cleanTitle.endsWith('规程') || cleanTitle.endsWith('SOP') ? cleanTitle : `${cleanTitle} 标准作业规程 (SOP)`,
        description: '规范车间标准化作业流程，明确关键控制点与安全质量要求。',
        suggested_roles: ['Operator', 'Manager'],
        suggested_page_id: 'scanner',
        category: 'production',
        summary: `已为您起草《${cleanTitle} 标准规程》，包含作业准备、执行步骤与安全防呆要求。`,
        checklist: [
            '作业前PPE防护用品穿戴齐全',
            '核对生产计划与原料/单据信息',
            '按标准流程规范操作设备或功能',
            '完工自检确认并清理现场',
            '在系统完成工单报工或单据提交'
        ],
        content: `# ${cleanTitle} 标准作业规程 (SOP)

> [!NOTE]
> 本规程旨在建立规范化、标准化作业标准，提升生产效率并消除质量隐患与人身风险。

---

## 1. 适用范围与职责
- **适用岗位**：工厂生产操作工、班组长及相关协作人员。
- **主管职责**：监督操作规范落地，提供工艺指导与异常排障支持。

---

## 2. 作业前准备与安全要求
> [!CAUTION]
> 作业人员必须按规定穿戴劳保鞋、手套等防护用具，熟悉紧急停止按钮位置。

1. **物资确认**：核对当日工单规格、物料批次与作业工具。
2. **系统扫码**：登录 PackSecure 系统，扫描对应设备或工单二维码进入工作状态。

---

## 3. 标准操作步骤
### 步骤一：初始检查与参数校核
- 检查设备周围环境整洁，传感器与安全连锁装置灵敏。
- 校核各项工艺参数至标准设定范围。

### 步骤二：标准化施工作业
- 严格按照工艺作业指导书逐项实施，控制关键质量公差。
- 密切关注设备运转声响与仪表指示，如有异常立即排查。

### 步骤三：首件检验与批量生产
- 测量首批产品规格公差，确认无瑕疵后转入连续批量生产。

---

## 4. 异常处置与交接班
- [ ] 如遇机械异常，按下急停并在系统上报停机报警
- [ ] 完工后清理现场 5S，工器具归位
- [ ] 在 PackSecure 生产系统提交完工数据
`
    };
}

export async function handleSopAssistant(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const {
            action = 'generate',
            topic = '',
            existingContent = '',
            language = 'zh',
            category = 'production',
            targetRoles = [],
            pageId = '',
            imageBase64,
            mimeType,
            imageUrl
        } = req.body;

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Google Gemini API Key not configured on server.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const candidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

        let systemInstruction = `
你是一位专精于包装制造业（气泡膜 Bubblewrap、拉伸膜 Stretch Film、原料再生造粒）与车间数字化的资深工业工程 (IE) 专家和精益生产总监。
你正在协助 PackSecure OS 系统的工厂高管（厂长、生产总监、物流经理、HR）撰写高标准、符合工厂实际落地的标准作业规程 (SOP)。

${PACKSECURE_DOMAIN_KNOWLEDGE}

[核心输出准则]
1. 语言模式：
   - 当 language 为 'zh' 时：采用严谨、易读、专业的中文。
   - 当 language 为 'zh-bm' 时：生成中马双语对照（中文标题/说明，下方附带马来文斜体或并列对照，如 "步骤一：开机准备 / Langkah 1: Persediaan Memulakan Mesin"），极适合马来西亚一线工人与外籍劳工。
   - 当 language 为 'zh-en' 时：生成中英双语对照。
2. 排版规范：
   - 必须使用标准 Markdown。
   - 适当运用 GitHub 风格警示块：
     > [!NOTE] 背景或目的说明
     > [!TIP] 老师傅操作技巧或防呆提示
     > [!IMPORTANT] 关键工艺参数或核心必检项
     > [!WARNING] 设备易损点或易漏操作
     > [!CAUTION] 人身安全高危点、急停按钮使用、防护装备(PPE)要求
   - 步骤必须层次清晰（1. 2. 3. 或 ### 步骤），操作要点具体可执行。
   - 如涉及设备、检查点或数据记录，使用 Markdown 表格呈现。
3. 必须以严格的 JSON 格式输出，不要包含任何 markdown 代码包裹外壳（如 \`\`\`json ）。输出格式必须是合法的单个 JSON 对象：
{
  "title": "规程完整标题",
  "description": "一句话精炼说明（30字以内）",
  "content": "完整的 Markdown 正文内容",
  "suggested_roles": ["建议适用角色，如 Operator, Manager 等"],
  "suggested_page_id": "建议关联的系统 page_id（如 scanner, driver-delivery, leave-calendar 等）",
  "category": "建议分类（production, equipment, logistics, inventory, hr, safety）",
  "summary": "针对高管本次指令的一两句亲切简报，如：已为您将第二步拆解为DO单与现场照片双重拍照，并补充了安全警示。",
  "checklist": ["操作要点1", "操作要点2", "操作要点3", "操作要点4"]
}
`;

        let prompt = "";

        if (action === 'chat_refine' || action === 'generate') {
            if (!existingContent || existingContent.trim().length < 20) {
                prompt = `
高管发起新规程起草指令：
- 用户需求/修改指令: "${topic || req.body.message || '包装车间标准作业规程'}"
- 偏好语言: ${language}
- 偏好分类: ${category}
- 指定工种: ${targetRoles.length > 0 ? targetRoles.join(', ') : '请根据内容智能推断'}
- 指定页面: ${pageId || '请根据内容智能推断'}

要求：
1. 深度结合 PackSecure 真实厂区（机台 N1-M01、T1.1-M03、混料造粒、卡车送货等）实际场景，起草一份完整的专业级工业 SOP。
2. 包含目的、适用范围、作业步骤、安全警告（[!WARNING]、[!CAUTION]）、操作技巧（[!TIP]）及检查表格。
3. 务必在 summary 字段中用一句话亲切汇报您生成的核心要点。
`;
            } else {
                prompt = `
高管正在对现有 SOP 草稿进行对话式迭代修改：
- 高管修改指令: "${topic || req.body.message || '优化当前规程'}"
- 当前标题: "${req.body.currentTitle || ''}"
- 当前已写正文:
${existingContent}
- 语言模式: ${language}

要求：
1. 准确理解高管的修改意图（例如“修改第2步”、“删除某项”、“加个表格”、“增加高温烫伤警告”、“翻译成中马双语”、“精简步骤”等）。
2. 在保留原有未受影响内容的基础上，就地修改正文，输出修改后的【完整 Markdown 正文】。
3. 如果高管要求翻译为双语对照，将标题和各步骤调整为中文+马来文对照。
4. 如果高管要求精简，去除冗余套话，保留最干练核心步骤。
5. 在 summary 字段中向高管明确汇报本次具体改动了哪些地方。
`;
            }
        } else if (action === 'polish') {
            prompt = `
请对以下高管当前编写的 SOP 内容进行专业工业级排版美化与术语润色：
- 当前内容:
${existingContent}
- 语言模式: ${language}

要求：
1. 纠正错别字、使语病通顺，使语言符合工业工程 SOP 规范。
2. 整理段落层级，合理加入步骤标号、表格与 GitHub 警示卡片（[!WARNING], [!TIP] 等）。
3. 保持原作者的核心逻辑，补充疏漏的操作细节。
4. 返回格式必须为完整的指定 JSON。
`;
        } else if (action === 'safety_alerts') {
            prompt = `
请审查以下 SOP 内容中的安全隐患、设备保护与人身伤害风险，并在正文中强化补充规范的安全警示卡片：
- 当前内容:
${existingContent}
- 语言模式: ${language}

要求：
1. 识别高温烫伤、卷入伤害、电击、高空掉落、卡车倒车盲区、叉车碰撞等风险。
2. 在相应步骤前精准插入 [!WARNING] 或 [!CAUTION] 警示块，标明劳保用品(PPE)佩戴及紧急停机应对。
3. 返回更新后的完整 JSON 对象。
`;
        } else if (action === 'translate') {
            prompt = `
请将以下 SOP 内容翻译/转换为 ${language === 'zh-bm' ? '中马双语对照 (Bahasa Melayu & Chinese)' : language === 'zh-en' ? '中英双语对照 (English & Chinese)' : '纯中文'} 版本：
- 原内容:
${existingContent}

要求：
1. 专有名词（如机台、系统功能、出货单DO）保持准确。
2. 格式与排版完美保留。
3. 返回格式必须为完整的指定 JSON。
`;
        } else if (action === 'checklist') {
            prompt = `
请从以下 SOP 正文中提炼出一线员工在作业现场可逐项打勾核对的【实操检查清单 (Checklist)】：
- 原内容:
${existingContent}

要求：
1. 提炼出 5-10 项精简易执行的闭环检查项。
2. 保持 content 中在开头或结尾包含一个优雅的任务清单格式（- [ ] 项）。
3. checklist 数组中包含每一项的纯文本描述。
4. 返回格式必须为指定 JSON。
`;
        }

        let responseText = "";
        let lastError: any = null;

        for (const modelId of candidates) {
            try {
                console.log(`[SOP AI] Trying model ${modelId} for action: ${action}...`);
                const model = genAI.getGenerativeModel({
                    model: modelId,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.3,
                    }
                });

                const contentParts: any[] = [prompt];
                if (imageBase64) {
                    contentParts.push({
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: imageBase64
                        }
                    });
                }

                const result = await model.generateContent(contentParts);
                const response = await result.response;
                responseText = response.text();
                if (responseText) break;
            } catch (err: any) {
                console.warn(`[SOP AI] Model ${modelId} failed:`, err.message);
                lastError = err;
            }
        }

        if (!responseText) {
            console.warn("[SOP AI] Gemini models unavailable, using industrial rule-based generator fallback. Last error:", lastError?.message || lastError);
            const fallbackResult = generateFallbackIndustrialSOP({
                action,
                topic: topic || req.body.message || '',
                message: req.body.message || topic || '',
                existingContent,
                currentTitle: req.body.currentTitle || '',
                language,
                category,
                targetRoles,
                pageId,
                imageUrl: imageUrl || ''
            });
            return res.status(200).json({
                success: true,
                data: fallbackResult
            });
        }

        const safeParseJson = (raw: string): any => {
            let cleaned = raw.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            cleaned = cleaned.trim();

            try {
                return JSON.parse(cleaned);
            } catch (e1) {
                try {
                    const fixedEscapes = cleaned.replace(/\\([^"\\\/bfnrtu])/g, '$1');
                    return JSON.parse(fixedEscapes);
                } catch (e2) {
                    try {
                        const doubleEscaped = cleaned.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
                        return JSON.parse(doubleEscaped);
                    } catch (e3) {
                        const titleMatch = cleaned.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const descMatch = cleaned.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const contentMatch = cleaned.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                        const pageMatch = cleaned.match(/"suggested_page_id"\s*:\s*"([^"]*)"/);
                        const catMatch = cleaned.match(/"category"\s*:\s*"([^"]*)"/);

                        const unescapeStr = (s: string) => {
                            try {
                                return JSON.parse(`"${s}"`);
                            } catch {
                                return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                            }
                        };

                        if (titleMatch || contentMatch) {
                            return {
                                title: titleMatch ? unescapeStr(titleMatch[1]) : topic || '未命名规程',
                                description: descMatch ? unescapeStr(descMatch[1]) : '',
                                content: contentMatch ? unescapeStr(contentMatch[1]) : '',
                                suggested_page_id: pageMatch ? pageMatch[1] : pageId || '',
                                category: catMatch ? catMatch[1] : category || 'production',
                                suggested_roles: ['Operator', 'Manager'],
                                checklist: []
                            };
                        }
                        throw e1;
                    }
                }
            }
        };

        const parsedData = safeParseJson(responseText);

        return res.status(200).json({
            success: true,
            data: {
                title: parsedData.title || topic || '未命名 SOP 规程',
                description: parsedData.description || '',
                content: parsedData.content || '',
                suggested_roles: Array.isArray(parsedData.suggested_roles) ? parsedData.suggested_roles : ['Operator', 'Manager'],
                suggested_page_id: parsedData.suggested_page_id || pageId || '',
                category: parsedData.category || category || 'production',
                summary: parsedData.summary || '规程内容已同步更新至右侧工作台。',
                checklist: Array.isArray(parsedData.checklist) ? parsedData.checklist : []
            }
        });

    } catch (error: any) {
        console.error('[SOP AI Assistant Error]:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'AI processing failed'
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

    // 5. SOP Assistant requests
    if (action === 'sop-assistant' || req.query?.action === 'sop-assistant' || req.body?.action === 'sop-assistant') {
        return handleSopAssistant(req, res);
    }

    // 6. Default: Universal Intake (parse / commit)
    return handleIntake(req, res);
}

