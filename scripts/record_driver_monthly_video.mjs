import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const supabaseClient = createClient(SUPABASE_URL, ANON_KEY);

const DRIVER_EMAIL = 'khailoon94@gmail.com';
const DRIVER_UID = 'd1c24ad1-85c2-4f45-9b6d-d3bb36e13390';

async function recordMonthlyCheckTutorial() {
    console.log("=== 🎥 Starting Driver Monthly Check Video Recording ===");

    // 1. Ensure today's trip is Delivered so earnings and checkbox appear clearly
    console.log("Updating orders for Day 19 to Delivered status...");
    await supabaseAdmin.from('sales_orders').update({
        status: 'Delivered',
        pod_photo_url: 'https://kdahubyhwndgyloaljak.supabase.co/storage/v1/object/public/work-photos/mock_do.jpg',
        pod_timestamp: new Date().toISOString()
    }).ilike('order_number', 'DO-MAX-260919%');

    // 2. Generate auth session
    console.log("Generating Driver auth session...");
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: DRIVER_EMAIL
    });
    if (linkErr) throw linkErr;

    const { data: sessionData, error: sessErr } = await supabaseClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink'
    });
    if (sessErr) throw sessErr;

    const rawDir = path.resolve('public/videos/monthly_raw');
    if (fs.existsSync(rawDir)) {
        fs.rmSync(rawDir, { recursive: true, force: true });
    }
    fs.mkdirSync(rawDir, { recursive: true });

    // 3. Launch Playwright
    console.log("Launching Edge for 9:16 mobile capture (390x844)...");
    const browser = await chromium.launch({
        channel: 'msedge',
        headless: true
    });

    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        recordVideo: {
            dir: rawDir,
            size: { width: 390, height: 844 }
        }
    });

    const page = await context.newPage();

    // Auto-accept any dialogs smoothly
    page.on('dialog', async dialog => {
        console.log(`[Browser Dialog] ${dialog.type()}: ${dialog.message()}`);
        await dialog.accept();
    });

    // Inject session and tutorial UI overlays
    await page.addInitScript((sess) => {
        localStorage.setItem('sb-kdahubyhwndgyloaljak-auth-token', JSON.stringify(sess));
        localStorage.setItem('lastActivePage', 'personal-report');
        localStorage.setItem('packsecure_lang', 'ms');

        // Helper to inject styles safely
        const injectStyles = () => {
            if (document.getElementById('tutorial-styles-monthly')) return;
            const style = document.createElement('style');
            style.id = 'tutorial-styles-monthly';
            style.innerHTML = `
                @keyframes pulseTouch {
                    0% { transform: scale(0.3); opacity: 0.9; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                .touch-indicator {
                    position: fixed;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: rgba(16, 185, 129, 0.45);
                    border: 2.5px solid #10b981;
                    pointer-events: none;
                    z-index: 999999;
                    transform: translate(-50%, -50%);
                    animation: pulseTouch 0.55s ease-out forwards;
                }
                #tutorial-step-card {
                    position: fixed;
                    bottom: 24px;
                    left: 16px;
                    right: 16px;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(16px);
                    border: 2px solid #10b981;
                    border-radius: 20px;
                    padding: 12px 16px;
                    z-index: 999998;
                    box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.8), 0 0 20px rgba(16, 185, 129, 0.4);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                    pointer-events: none;
                }
                #tutorial-step-badge {
                    padding: 4px 10px;
                    background: #059669;
                    color: white;
                    font-size: 11px;
                    font-weight: 900;
                    border-radius: 10px;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    flex-shrink: 0;
                }
                #tutorial-step-text-my {
                    font-size: 13px;
                    font-weight: 900;
                    color: #ffffff;
                    line-height: 1.25;
                }
                #tutorial-step-text-zh {
                    font-size: 11px;
                    font-weight: 700;
                    color: #6ee7b7;
                    margin-top: 2px;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        };

        window.__setTutorialStep = (stepNum, textMy, textZh) => {
            injectStyles();
            let card = document.getElementById('tutorial-step-card');
            if (!card) {
                card = document.createElement('div');
                card.id = 'tutorial-step-card';
                card.innerHTML = `
                    <div id="tutorial-step-badge"></div>
                    <div>
                        <div id="tutorial-step-text-my"></div>
                        <div id="tutorial-step-text-zh"></div>
                    </div>
                `;
                document.body.appendChild(card);
            }

            document.getElementById('tutorial-step-badge').innerText = `Langkah ${stepNum}`;
            document.getElementById('tutorial-step-text-my').innerText = textMy;
            document.getElementById('tutorial-step-text-zh').innerText = textZh;

            card.style.transform = 'translateY(10px) scale(0.96)';
            setTimeout(() => {
                card.style.transform = 'translateY(0) scale(1)';
            }, 50);
        };

        window.__showTouch = (x, y) => {
            injectStyles();
            const el = document.createElement('div');
            el.className = 'touch-indicator';
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 600);
        };
    }, sessionData.session);

    // 4. Open app
    console.log("Navigating to Personal Monthly Report...");
    await page.goto('http://localhost:5173');
    await page.waitForSelector('table', { timeout: 25000 });
    await page.waitForTimeout(2000);

    // ==========================================
    // STEP 1: WELCOME & SUMMARY OVERVIEW
    // ==========================================
    console.log("Executing Step 1: Overview Summary...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '1 / 5',
            'Buka Laporan Bulanan Pemandu Setiap Hari',
            '步骤 1: 每日收工后进入个人月报，核查当月出勤与出车'
        );
    });
    await page.waitForTimeout(2800);

    // Scroll slightly to view month cards
    await page.evaluate(() => window.scrollBy({ top: 260, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    // ==========================================
    // STEP 2: LOCATE TODAY'S TRIP ROW (19 SEP)
    // ==========================================
    console.log("Executing Step 2: Locate Day 19 Trip...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '2 / 5',
            'Cari Rekod Hari Ini (19 Sep 2026)',
            '步骤 2: 在每日时间线中定位今日出车记录 (19 Sep)'
        );
    });
    await page.waitForTimeout(2000);

    // Scroll directly to row 19
    await page.evaluate(() => {
        const allTds = Array.from(document.querySelectorAll('td'));
        const td19 = allTds.find(td => td.innerText.trim().startsWith('19'));
        if (td19) {
            td19.closest('tr')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
    await page.waitForTimeout(2200);

    // Scroll table horizontally to reveal Trip earnings & Checkbox
    await page.evaluate(() => {
        const overflowDiv = document.querySelector('.overflow-x-auto');
        if (overflowDiv) {
            overflowDiv.scrollTo({ left: 360, behavior: 'smooth' });
        }
    });
    await page.waitForTimeout(2200);

    // ==========================================
    // STEP 3: CHECK COMMISSIONS & TRIP BREAKDOWN
    // ==========================================
    console.log("Executing Step 3: Check Commission & Base...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '3 / 5',
            'Semak Elaun Asas (RM 80) & Komisen 10 Drops',
            '步骤 3: 仔细核对出车底薪与每单提成是否准确'
        );
    });

    // Touch on the Trip button to open details modal
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tripBtn = buttons.find(b => b.innerText.includes('TRIP') || b.innerText.includes('RM'));
        if (tripBtn) {
            const r = tripBtn.getBoundingClientRect();
            window.__showTouch(r.x + r.width / 2, r.y + r.height / 2);
            tripBtn.click();
        }
    });
    await page.waitForTimeout(3000);

    // Close the trip detail modal if opened
    await page.evaluate(() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button:has(svg)');
        if (closeBtn) {
            const r = closeBtn.getBoundingClientRect();
            window.__showTouch(r.x + r.width / 2, r.y + r.height / 2);
            closeBtn.click();
        }
    });
    await page.waitForTimeout(1800);

    // ==========================================
    // STEP 4: TICK CONFIRMATION CHECKBOX [✓]
    // ==========================================
    console.log("Executing Step 4: Tick Confirmation [✓]...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '4 / 5',
            'Tandakan [✓] untuk Mengesahkan Trip Ini',
            '步骤 4: 确认所有点位与金额无误后，点击打勾 [✓]'
        );
    });
    await page.waitForTimeout(1500);

    // Locate the checkbox on row 19 and click it
    await page.evaluate(() => {
        const allTds = Array.from(document.querySelectorAll('td'));
        const td19 = allTds.find(td => td.innerText.trim().startsWith('19'));
        if (td19) {
            const tr = td19.closest('tr');
            if (tr) {
                const checkbox = tr.querySelector('input[type="checkbox"]:not([disabled])');
                if (checkbox) {
                    const r = checkbox.getBoundingClientRect();
                    window.__showTouch(r.x + r.width / 2, r.y + r.height / 2);
                    checkbox.click();
                }
            }
        }
    });
    await page.waitForTimeout(2800);

    // ==========================================
    // STEP 5: PRE-EDIT & HR LOCK REMINDER
    // ==========================================
    console.log("Executing Step 5: HR Lock Reminder...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '5 / 5',
            'Jika Ada Ralat, Maklumkan HR Sebelum Kunci',
            '步骤 5: 如有金额或单号不符，请在月底HR锁单前报备'
        );
    });
    await page.waitForTimeout(3000);

    // Outro banner
    await page.evaluate(() => {
        window.__setTutorialStep(
            'SELESAI ✅',
            'Semak Setiap Hari Demi Menjamin Hak Gaji Anda!',
            '每日随手核对，保障辛苦所得，准时发薪安心无忧！'
        );
    });
    await page.waitForTimeout(3500);

    // Finish recording
    console.log("Closing browser and finalizing video file...");
    await page.close();
    await context.close();
    await browser.close();

    // Rename recorded file to public/videos/driver_monthly_check_tutorial.webm
    const files = fs.readdirSync(rawDir);
    const videoFile = files.find(f => f.endsWith('.webm'));
    if (videoFile) {
        const src = path.join(rawDir, videoFile);
        const dest = path.resolve('public/videos/driver_monthly_check_tutorial.webm');
        fs.copyFileSync(src, dest);
        console.log(`✅ Video 2 generated successfully: ${dest} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
    } else {
        console.error("No webm video found in raw directory!");
    }
}

recordMonthlyCheckTutorial().catch(err => {
    console.error("Recording error:", err);
    process.exit(1);
});
