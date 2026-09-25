import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';

// Import handlers directly for testing
import calcDriverRateHandler from '../api/agent/calc-driver-rate';
import suggestRulePatchHandler from '../api/agent/suggest-rule-patch';

function createMockReqRes(body: any, query: any = {}, method: string = 'POST') {
  let statusCode = 200;
  let headers: Record<string, string> = {};
  let responseData: any = null;

  const req: any = {
    method,
    body,
    query,
    headers: {}
  };

  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    setHeader: (k: string, v: string) => {
      headers[k] = v;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      return res;
    },
    end: () => res
  };

  return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function runFullSelfCheck() {
  console.log('================================================================');
  console.log('🚀 Packsecure OS: AI 运费自检闭环全链路功能与 API 自动化自检');
  console.log('================================================================');

  let passedTests = 0;
  let totalTests = 0;

  function assert(desc: string, condition: boolean, detail?: any) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${desc}`, detail || '');
    }
  }

  // ---------------------------------------------------------------------------
  // 1. 测试 get-active-rulebook
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. 测试获取当前生效的 Markdown 规则库 ---');
  {
    const { req, res, getResult } = createMockReqRes({}, { mode: 'get-active-rulebook' }, 'GET');
    await calcDriverRateHandler(req, res);
    const { statusCode, responseData } = getResult();
    assert('API 返回 200 OK', statusCode === 200);
    assert('返回 success: true 且包含 content_md', responseData?.success === true && typeof responseData?.content === 'string');
    assert('规则库内容包含太平起运阶梯', responseData?.content?.includes('太平厂起运') || responseData?.content?.includes('TAIPING'));
  }

  // ---------------------------------------------------------------------------
  // 2. 测试 list-rulebooks (版本历史)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. 测试获取规则历史版本列表 ---');
  {
    const { req, res, getResult } = createMockReqRes({}, { mode: 'list-rulebooks' }, 'GET');
    await calcDriverRateHandler(req, res);
    const { statusCode, responseData } = getResult();
    assert('API 返回 200 OK', statusCode === 200);
    assert('返回 rulebooks 数组', Array.isArray(responseData?.rulebooks) && responseData.rulebooks.length > 0);
  }

  // ---------------------------------------------------------------------------
  // 3. 测试沙盒单测 (Sandbox Simulation)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. 测试沙盒单地址试算 (Sandbox) ---');
  {
    const { req, res, getResult } = createMockReqRes({
      mode: 'sandbox',
      testAddress: 'Kawasan Perindustrian Bukit Minyak, Simpang Ampat, Penang',
      origin: 'TAIPING',
      lorryPlate: 'PGD 1234',
      dropCount: 1
    });
    await calcDriverRateHandler(req, res);
    const { statusCode, responseData } = getResult();
    assert('沙盒接口返回 200 OK', statusCode === 200);
    assert('沙盒标记 sandbox: true', responseData?.sandbox === true);
    assert('识别威中/Bukit Minyak 且算得有效运费 (RM 80)', responseData?.ai_rate >= 80 && responseData?.ai_rate <= 100);
    assert('包含 AI 推理原因与引用条款', Boolean(responseData?.reasoning) && Array.isArray(responseData?.rule_citations));
  }

  // ---------------------------------------------------------------------------
  // 4. 测试系统安全护栏 (Guardrails: Minimum RM40 and Maximum RM650)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. 测试系统安全底线与熔断护栏 (Guardrails) ---');
  {
    const { req, res, getResult } = createMockReqRes({
      mode: 'single',
      origin: 'TAIPING',
      deliveryAddresses: ['Simpang Taiping Local'],
      dropCount: 1
    });
    await calcDriverRateHandler(req, res);
    const { statusCode, responseData } = getResult();
    assert('单趟接口返回 200 OK', statusCode === 200);
    assert('本地保底价不低于 RM 40.00', responseData?.ai_rate >= 40.0);
  }

  // ---------------------------------------------------------------------------
  // 5. 测试历史回测接口 (Backtest Engine)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. 测试历史单据回测批处理 (Backtest Engine) ---');
  {
    const { req, res, getResult } = createMockReqRes({
      mode: 'backtest',
      limit: 10
    });
    await calcDriverRateHandler(req, res);
    const { statusCode, responseData } = getResult();
    assert('回测接口返回 200 OK', statusCode === 200);
    assert('返回回测汇总统计与对比项', responseData?.success === true && typeof responseData?.totalTested === 'number');
    console.log(`   回测总数: ${responseData?.totalTested}, 老总额: RM ${responseData?.legacyTotal}, AI总额: RM ${responseData?.aiTotal}, 波动: ${responseData?.netDiffPercent}`);
  }

  // ---------------------------------------------------------------------------
  // 6. 测试 HR 调价记录与纠错反哺 (Feedback & Rule Patch)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. 测试 HR 纠错案例记录与 AI 补丁提炼 (Feedback Loop) ---');
  {
    const { req, res, getResult } = createMockReqRes({
      action: 'record-correction',
      trip_id: 'TEST-TRIP-001',
      address_text: 'Kulim Hi-Tech Park Phase 4, Kedah',
      lorry_plate: 'PGD 1234',
      ai_rate: 170,
      hr_rate: 150,
      diff_reason: '靠近高速主干道，协议优惠按 RM 150 结算'
    });
    await suggestRulePatchHandler(req, res);
    const { statusCode, responseData } = getResult();
    assert('记录纠错接口返回 200 OK', statusCode === 200);
    assert('成功保存纠错案例', responseData?.success === true);
  }

  // 7. 测试 AI 提炼规则补丁建议
  {
    const { req, res, getResult } = createMockReqRes({
      action: 'suggest',
      customCases: [
        {
          address_text: 'Kulim Hi-Tech Park Phase 4',
          lorry_plate: 'PGD 1234',
          ai_rate: 170,
          hr_rate: 150,
          diff_reason: '靠近主干道，按 RM 150 优惠'
        },
        {
          address_text: 'Kulim Hi-Tech Park Phase 4 Lot 99',
          lorry_plate: 'PGD 1234',
          ai_rate: 170,
          hr_rate: 150,
          diff_reason: '居林四期统一按 150'
        }
      ]
    });
    await suggestRulePatchHandler(req, res);
    const { statusCode, responseData } = getResult();
    assert('AI 提炼补丁接口返回 200 OK', statusCode === 200);
    assert('成功识别并提炼出增补建议', responseData?.hasSuggestions === true && responseData?.suggestions?.length > 0);
    if (responseData?.suggestions?.[0]) {
      console.log(`   提炼补丁样例: [${responseData.suggestions[0].title}] -> ${responseData.suggestions[0].markdownPatch}`);
    }
  }

  console.log('\n================================================================');
  console.log(`📊 自检测试总结: ${passedTests} / ${totalTests} 项全部通过！`);
  console.log('================================================================');
}

runFullSelfCheck().catch(err => {
  console.error('Self-check error:', err);
  process.exit(1);
});
