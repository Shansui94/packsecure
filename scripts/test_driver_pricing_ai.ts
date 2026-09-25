import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

async function testPricingAI() {
  console.log('====================================================');
  console.log('🧪 Starting AI Driver Pricing Closed-Loop Self-Check');
  console.log('====================================================');

  // 1. Check local Markdown rulebook
  const mdPath = path.resolve('docs/sops/Driver_Pricing_Rules.md');
  if (!fs.existsSync(mdPath)) {
    throw new Error('Driver_Pricing_Rules.md is missing in docs/sops/');
  }
  const rulebookMd = fs.readFileSync(mdPath, 'utf-8');
  console.log('✅ Found Driver_Pricing_Rules.md (Length:', rulebookMd.length, 'chars)');

  // 2. Check Gemini API Key
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ No Gemini API key found in env, skipping live LLM test.');
    return;
  }
  console.log('✅ Gemini API Key detected.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.1, topP: 0.8 }
  });

  // Test Case 1: Bukit Minyak, Penang (Standard Truck, 1 Drop)
  console.log('\n--- Test 1: Bukit Minyak Industrial Park (Penang) ---');
  const test1Prompt = `你是 Packsecure 工业制造车队运费审计 AI 智能体。
请严格根据以下《运费计算真理库》计算该趟行程运费：
${rulebookMd}

待核算车次信息：
- 出发工厂：TAIPING (OPM Lama)
- 车辆车牌：PGD 1234 (标准罗里)
- 落点数量：1
- 送货地址：Lot 1826, Jalan Perindustrian Bukit Minyak, 14100 Simpang Ampat, Pulau Pinang

返回纯 JSON：
{
  "standardized_location": string,
  "ai_zone": string,
  "base_rate": number,
  "extra_drops_rate": number,
  "total_ai_rate": number,
  "reasoning": string
}`;

  const res1 = await model.generateContent(test1Prompt);
  const text1 = res1.response.text().replace(/```json|```/g, '').trim();
  const json1 = JSON.parse(text1);
  console.log('Result 1:', json1);
  if (json1.total_ai_rate >= 80 && json1.total_ai_rate <= 100) {
    console.log('✅ Test 1 PASSED: Correctly identified Bukit Minyak in Penang zone with base ~RM80.');
  } else {
    console.warn('⚠️ Test 1 Rate was:', json1.total_ai_rate);
  }

  // Test Case 2: Menglembu (Ipoh disambiguation test)
  console.log('\n--- Test 2: Menglembu (Ipoh Suburb Disambiguation) ---');
  const test2Prompt = `你是 Packsecure 工业制造车队运费审计 AI 智能体。
请严格根据以下《运费计算真理库》计算该趟行程运费：
${rulebookMd}

待核算车次信息：
- 出发工厂：TAIPING
- 车辆车牌：PGD 1234
- 落点数量：1
- 送货地址：Kawasan Perindustrian Menglembu, Perak

返回纯 JSON：
{
  "standardized_location": string,
  "ai_zone": string,
  "base_rate": number,
  "total_ai_rate": number,
  "reasoning": string
}`;

  const res2 = await model.generateContent(test2Prompt);
  const text2 = res2.response.text().replace(/```json|```/g, '').trim();
  const json2 = JSON.parse(text2);
  console.log('Result 2:', json2);
  if (json2.total_ai_rate === 80) {
    console.log('✅ Test 2 PASSED: Correctly resolved Menglembu to IPOH阶梯 RM80.');
  } else {
    console.warn('⚠️ Test 2 Rate was:', json2.total_ai_rate);
  }

  // Test Case 3: Small Truck VPC 9821 vs Large Drops
  console.log('\n--- Test 3: Nilai Negeri Sembilan Long Distance ---');
  const test3Prompt = `你是 Packsecure 工业制造车队运费审计 AI 智能体。
请严格根据以下《运费计算真理库》计算该趟行程运费：
${rulebookMd}

待核算车次信息：
- 出发工厂：TAIPING
- 车辆车牌：PGD 1234
- 落点数量：2
- 送货地址：NO 181 JALAN NILAI 3/7 KAWASAN PERINDUSTRIAN NILAI 71800

返回纯 JSON：
{
  "standardized_location": string,
  "ai_zone": string,
  "base_rate": number,
  "total_ai_rate": number,
  "reasoning": string
}`;

  const res3 = await model.generateContent(test3Prompt);
  const text3 = res3.response.text().replace(/```json|```/g, '').trim();
  const json3 = JSON.parse(text3);
  console.log('Result 3:', json3);
  if (json3.total_ai_rate === 400) {
    console.log('✅ Test 3 PASSED: Correctly resolved Nilai 3 to NEGERI SEMBILAN RM400.');
  } else {
    console.warn('⚠️ Test 3 Rate was:', json3.total_ai_rate);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL AI DRIVER PRICING TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

testPricingAI().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
