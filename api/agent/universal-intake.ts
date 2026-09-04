import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 现场极速智能规则启发式解析引擎 (离线/API受限/高并发防断流本地备用方案)
 */
function parseWithLocalRules({ speechText = '', context = {}, imageBase64 }: any): any {
    const raw = (speechText || '').trim();
    const lower = raw.toLowerCase();

    const data: any = {
        intent: 'operator_special_work',
        workCategory: 'general',
        confidence: 0.92,
        summary: raw || '现场工作登记',
        weight: null,
        machineId: context?.currentMachine || 'T1-1',
        machineLoginCode: '',
        sku: '',
        defectReason: '',
        doNumber: '',
        containerNo: '',
        sealNo: '',
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

    // 1. 登出机台 / 机器登出 / 机器登录 / 切换机台
    if (raw.includes('登出') || raw.includes('下机') || raw.includes('退出') || lower.includes('logout') || lower.includes('clock out')) {
        data.intent = 'machine_login';
        data.isLogout = true;
        data.machineLoginCode = context?.currentMachine || 'T1-1';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

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
                const { data: photoRecord, error: photoErr } = await supabase
                    .from('work_photos')
                    .insert({
                        employee_id: empId,
                        employee_name: empName,
                        photo_url: photoUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop',
                        ai_description: parsedData.summary || '万能快拍采集入库',
                        user_note: speechText || parsedData.rawText || '',
                        category: parsedData.intent || 'other',
                        ai_tags: [parsedData.intent, parsedData.machineId, parsedData.sku].filter(Boolean),
                        risk_flag: !!parsedData.riskFlag,
                        risk_reason: parsedData.riskReason || null,
                        location: finalGps || null,
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
                // 生产报工入库
                try {
                    const weightVal = Number(parsedData.weight) || 0;
                    const { data: prodLog, error: prodErr } = await supabase
                        .from('production_logs_v2')
                        .insert({
                            machine_name: parsedData.machineId || '通用机台',
                            sku: parsedData.sku || 'SF-500-150-18-CLR',
                            weight: weightVal,
                            net_weight: weightVal,
                            gross_weight: weightVal,
                            status: 'Completed',
                            operator_name: empName,
                            photo_url: photoUrl,
                            notes: `【万能快拍生产入库】${parsedData.summary || ''}`,
                            created_at: finalTimestamp
                        })
                        .select('id')
                        .maybeSingle();

                    if (!prodErr && prodLog) {
                        commitResults.recordsCreated.push({ table: 'production_logs_v2', id: prodLog.id });
                    }
                } catch (e) {
                    console.warn('Production log insert warning:', e);
                }
            } else if (parsedData.intent === 'defect_scrap') {
                // 废料次品记录
                try {
                    const scrapWeight = Number(parsedData.weight) || 0;
                    const { data: scrapLog, error: scrapErr } = await supabase
                        .from('mobile_inspection_logs')
                        .insert({
                            log_type: 'material',
                            machine_name: parsedData.machineId || '废料称重',
                            reaction_tag: 'normal',
                            reaction_notes: `次品废料报废: ${scrapWeight}kg. 原因: ${parsedData.defectReason || '未注明'}`,
                            photo_url: photoUrl || '',
                            operator_name: empName,
                            operator_role: 'Operator',
                            change_amount: scrapWeight,
                            created_at: finalTimestamp
                        })
                        .select('id')
                        .maybeSingle();

                    if (!scrapErr && scrapLog) {
                        commitResults.recordsCreated.push({ table: 'mobile_inspection_logs', id: scrapLog.id });
                    }
                } catch (e) {
                    console.warn('Scrap log insert warning:', e);
                }
            } else if (parsedData.intent === 'machine_anomaly') {
                // 设备点检异常与停机
                try {
                    const { data: inspLog, error: inspErr } = await supabase
                        .from('mobile_inspection_logs')
                        .insert({
                            log_type: 'machine_adjustment',
                            machine_name: parsedData.machineId || '点检机台',
                            adjustment_position: parsedData.defectReason || '设备异常停机',
                            adjustment_notes: parsedData.summary || '万能快拍异常提交',
                            photo_url: photoUrl || '',
                            operator_name: empName,
                            created_at: finalTimestamp
                        })
                        .select('id')
                        .maybeSingle();

                    if (!inspErr && inspLog) {
                        commitResults.recordsCreated.push({ table: 'mobile_inspection_logs', id: inspLog.id });
                    }
                } catch (e) {
                    console.warn('Machine anomaly insert warning:', e);
                }
            } else if (parsedData.intent === 'delivery_pod') {
                // 物流送货签收 (POD)
                try {
                    const doNum = parsedData.doNumber;
                    if (doNum) {
                        const { data: orderUpdate, error: orderErr } = await supabase
                            .from('sales_orders')
                            .update({
                                status: 'Delivered',
                                notes: `【POD签收】于 ${finalTimestamp} 完成送达。地点: ${finalGps}`
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
                // 操作员 6 大专项作业 (OT, Container 原料采购, driver order 协助Trip, handling 搬运, shopee, boss order)
                try {
                    const workCat = parsedData.workCategory || 'general';
                    const detailDesc = [
                        parsedData.containerNo ? `柜号: ${parsedData.containerNo}` : '',
                        parsedData.sealNo ? `封条: ${parsedData.sealNo}` : '',
                        parsedData.otHours ? `加班工时: ${parsedData.otHours}小时` : '',
                        parsedData.palletCount ? `托数/件数: ${parsedData.palletCount}托` : '',
                        parsedData.warehouseBay ? `存放库位: ${parsedData.warehouseBay}` : '',
                        parsedData.driverNameOrPlate ? `司机/车牌: ${parsedData.driverNameOrPlate}` : '',
                        parsedData.tripId ? `行程单号: ${parsedData.tripId}` : '',
                        parsedData.trackingNo ? `运单号: ${parsedData.trackingNo}` : '',
                        parsedData.bossOrderNote ? `特单说明: ${parsedData.bossOrderNote}` : ''
                    ].filter(Boolean).join(' | ');

                    const { data: taskLog, error: taskErr } = await supabase
                        .from('tasks')
                        .insert({
                            title: `【${workCat}】${parsedData.summary || '现场专项作业'}`,
                            description: `${detailDesc}\n备注: ${speechText || parsedData.rawText || ''}`,
                            status: 'Done',
                            priority: workCat === 'boss_order' ? 'High' : 'Normal',
                            assigned_to: empId,
                            created_at: finalTimestamp
                        })
                        .select('id')
                        .maybeSingle();

                    if (!taskErr && taskLog) {
                        commitResults.recordsCreated.push({ table: 'tasks', id: taskLog.id, category: workCat });
                    }
                } catch (e) {
                    console.warn('Operator special work insert warning:', e);
                }
            } else if (parsedData.intent === 'machine_login' || parsedData.machineLoginCode) {
                // 操作员机台登录与绑定 / 登出
                const targetMachine = parsedData.machineLoginCode || parsedData.machineId || 'T1-1';
                const isLogout = !!parsedData.isLogout ||
                    (parsedData.summary && (parsedData.summary.includes('登出') || parsedData.summary.includes('下机'))) ||
                    (speechText && (speechText.includes('登出') || speechText.includes('下机')));

                try {
                    if (isLogout) {
                        const { data: attUpdate, error: attErr } = await supabase
                            .from('operator_attendance')
                            .update({
                                clock_out: finalTimestamp,
                                notes: `万能快拍登出机台: ${targetMachine}`
                            })
                            .eq('operator_name', empName)
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
                        const { data: attLog, error: attErr } = await supabase
                            .from('operator_attendance')
                            .insert({
                                operator_id: empId || 'Unknown',
                                operator_name: empName,
                                machine_id: targetMachine,
                                clock_in: finalTimestamp,
                                notes: `万能快拍扫码/登录绑定机台: ${targetMachine}`
                            })
                            .select('id')
                            .maybeSingle();

                        if (!attErr && attLog) {
                            commitResults.recordsCreated.push({ table: 'operator_attendance', id: attLog.id, machine: targetMachine });
                        }
                    }
                } catch (e) {
                    console.warn('Machine login/logout attendance warning:', e);
                }
            }

            // Also record general activity log
            try {
                await supabase.from('activity_logs').insert({
                    user_name: empName,
                    action_type: parsedData.intent === 'machine_login' ? 'MACHINE_LOGIN' : 'UNIVERSAL_INTAKE_COMMIT',
                    details: `[${parsedData.intent}] ${parsedData.summary || ''} (机台: ${parsedData.machineLoginCode || parsedData.machineId || '-'})`,
                    ip_or_gps: finalGps,
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
                console.warn('[Universal Intake] Gemini generation failed or restricted (e.g. 403 Forbidden), fallback to local rule engine:', geminiErr.message);
            }
        }

        // Seamless fallback to local rules if Gemini was offline, key restricted (403), or parsing failed
        if (!parsed) {
            parsed = parseWithLocalRules({ speechText, context, imageBase64 });
            parsed.isLocalFallback = true;
        }

        // Enhance with caller metadata
        parsed.imageUrl = rawImageUrl || (imageBase64 ? `data:image/jpeg;base64,${imageBase64.substring(0, 100)}...` : '');
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
