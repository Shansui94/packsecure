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

const LORRY_ID = '23572333-dba1-421a-b6fd-83d937cfe954';
const DRIVER_EMAIL = 'khailoon94@gmail.com';
const DRIVER_UID = 'd1c24ad1-85c2-4f45-9b6d-d3bb36e13390';

// Canvas sample image generator for realistic mock photos
function createMockImageBase64(type, title, subtitle) {
    // Generate an SVG data url then convert to base64 jpeg simulation
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
        <rect width="600" height="600" fill="${type === 'do' ? '#f8fafc' : '#1e293b'}"/>
        ${type === 'do' ? `
            <rect x="40" y="40" width="520" height="520" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
            <text x="70" y="100" font-family="sans-serif" font-size="24" font-weight="900" fill="#0f172a">PACKSECURE - DELIVERY ORDER</text>
            <text x="70" y="135" font-family="monospace" font-size="18" font-weight="bold" fill="#2563eb">DO NO: DO-MAX-260919-001</text>
            <text x="70" y="170" font-family="sans-serif" font-size="16" fill="#475569">Customer: KEDAI PLASTIK TAIPING</text>
            <line x1="70" y1="200" x2="530" y2="200" stroke="#e2e8f0" stroke-width="2"/>
            <text x="70" y="240" font-family="sans-serif" font-size="16" fill="#1e293b">1. STRETCH FILM 500MM x 2.2KG - 120 ROLLS</text>
            <text x="70" y="275" font-family="sans-serif" font-size="16" fill="#1e293b">2. PP STRAPPING BAND 15MM - 24 ROLLS</text>
            <!-- Stamp Box -->
            <rect x="300" y="360" width="220" height="130" rx="8" fill="#fef2f2" stroke="#ef4444" stroke-width="4" stroke-dasharray="6,4"/>
            <text x="320" y="400" font-family="sans-serif" font-size="16" font-weight="900" fill="#dc2626">DITERIMA DENGAN BAIK</text>
            <text x="340" y="430" font-family="sans-serif" font-size="13" font-weight="bold" fill="#dc2626">19 SEP 2026</text>
            <text x="320" y="465" font-family="monospace" font-size="14" fill="#b91c1c">COP & TANDATANGAN</text>
        ` : `
            <rect x="40" y="40" width="520" height="520" rx="16" fill="#0f172a" stroke="#334155" stroke-width="4"/>
            <text x="70" y="90" font-family="sans-serif" font-size="22" font-weight="900" fill="#38bdf8">📸 BUKTI LOKASI BARANG / CARGO PROOF</text>
            <text x="70" y="125" font-family="sans-serif" font-size="15" fill="#94a3b8">Kedai Plastik Taiping (Di hadapan premis)</text>
            <!-- Pallet representation -->
            <rect x="120" y="180" width="360" height="260" rx="12" fill="#3b82f6" opacity="0.3"/>
            <rect x="140" y="200" width="100" height="120" rx="8" fill="#0284c7"/>
            <rect x="250" y="200" width="100" height="120" rx="8" fill="#0284c7"/>
            <rect x="360" y="200" width="100" height="120" rx="8" fill="#0284c7"/>
            <rect x="140" y="330" width="100" height="90" rx="8" fill="#0369a1"/>
            <rect x="250" y="330" width="100" height="90" rx="8" fill="#0369a1"/>
            <rect x="360" y="330" width="100" height="90" rx="8" fill="#0369a1"/>
            <rect x="100" y="450" width="400" height="30" rx="4" fill="#b45309"/>
            <text x="70" y="525" font-family="sans-serif" font-size="16" font-weight="bold" fill="#4ade80">✅ Barang selamat diturunkan di pintu hadapan</text>
        `}
    </svg>`;
    return Buffer.from(svg).toString('base64');
}

async function recordDeliveryTutorial() {
    console.log("=== 🎥 Starting Driver Delivery Video Recording ===");

    // 1. Prepare initial database state
    console.log("Resetting Lorry APD 9821 to Available...");
    await supabaseAdmin.from('lorries').update({
        driver_id: null,
        driver_name: null,
        status: 'Available'
    }).eq('id', LORRY_ID);

    console.log("Resetting Drop 1 (DO-MAX-260919-001) to Loaded...");
    await supabaseAdmin.from('sales_orders').update({
        status: 'Loaded',
        pod_photo_url: null,
        notes: '[Trip: Trip 1] Test Drop 01'
    }).eq('order_number', 'DO-MAX-260919-001');

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

    const rawDir = path.resolve('public/videos/delivery_raw');
    if (fs.existsSync(rawDir)) {
        fs.rmSync(rawDir, { recursive: true, force: true });
    }
    fs.mkdirSync(rawDir, { recursive: true });

    // 3. Launch Playwright
    console.log("Launching Edge for 9:16 mobile capture (390x844)...");
    const browser = await chromium.launch({
        channel: 'msedge',
        headless: true,
        args: ['--use-fake-ui-for-media-stream']
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
        localStorage.setItem('lastActivePage', 'delivery-driver');
        localStorage.setItem('packsecure_lang', 'ms');

        // Helper to inject styles when DOM is ready
        const injectStyles = () => {
            if (document.getElementById('tutorial-styles')) return;
            const style = document.createElement('style');
            style.id = 'tutorial-styles';
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
                    background: rgba(245, 158, 11, 0.45);
                    border: 2.5px solid #fbbf24;
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
                    border: 2px solid #3b82f6;
                    border-radius: 20px;
                    padding: 12px 16px;
                    z-index: 999998;
                    box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 130, 246, 0.4);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                    pointer-events: none;
                }
                #tutorial-step-card.step-green {
                    border-color: #10b981;
                    box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.8), 0 0 20px rgba(16, 185, 129, 0.4);
                }
                #tutorial-step-badge {
                    padding: 4px 10px;
                    background: #2563eb;
                    color: white;
                    font-size: 11px;
                    font-weight: 900;
                    border-radius: 10px;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    flex-shrink: 0;
                }
                #tutorial-step-card.step-green #tutorial-step-badge {
                    background: #059669;
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
                    color: #93c5fd;
                    margin-top: 2px;
                }
                #tutorial-step-card.step-green #tutorial-step-text-zh {
                    color: #6ee7b7;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        };

        // Function to update floating tutorial card
        window.__setTutorialStep = (stepNum, textMy, textZh, isSuccess = false) => {
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

            if (isSuccess) {
                card.classList.add('step-green');
            } else {
                card.classList.remove('step-green');
            }

            document.getElementById('tutorial-step-badge').innerText = `Langkah ${stepNum}`;
            document.getElementById('tutorial-step-text-my').innerText = textMy;
            document.getElementById('tutorial-step-text-zh').innerText = textZh;

            card.style.transform = 'translateY(10px) scale(0.96)';
            setTimeout(() => {
                card.style.transform = 'translateY(0) scale(1)';
            }, 50);
        };

        // Function to show touch indicator
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
    console.log("Navigating to Driver Delivery...");
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(4000);

    // Helper to click with visual touch ripple
    const tapElement = async (selector, description) => {
        console.log(`[Tap] ${description}...`);
        const el = await page.waitForSelector(selector, { timeout: 8000 });
        const box = await el.boundingBox();
        if (box) {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            await page.evaluate(({ x, y }) => window.__showTouch(x, y), { x: cx, y: cy });
            await page.waitForTimeout(150);
            await el.click();
        } else {
            await el.click();
        }
    };

    // ==========================================
    // STEP 1: SCAN LORRY QR & BIND APD 9821
    // ==========================================
    console.log("Executing Step 1: Bind Lorry...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '1 / 6',
            'Ketik untuk Imbas QR Lori (APD 9821)',
            '步骤 1: 点击扫描车头仪表盘二维码绑定货车'
        );
    });
    await page.waitForTimeout(2200);

    // Tap scan button
    await tapElement('button:has-text("Ketik untuk Imbas QR Lori")', 'Tap Scan Lorry QR');
    await page.waitForTimeout(1800);

    // Trigger QR scan simulated detection
    console.log("Simulating QR Scan code for APD 9821...");
    await page.evaluate((lorryId) => {
        const qrJson = JSON.stringify({
            type: 'LorryBind',
            lorryId: lorryId,
            plate: 'APD 9821'
        });
        // Call the internal scan complete handler
        if (window.__driverDeliveryHooks) {
            window.__driverDeliveryHooks.scanLorry(qrJson);
        } else {
            // Find input or simulated call
            const scanner = document.querySelector('[key="driver-lorry-scanner"]');
            if (scanner && window.__scanLorry) {
                window.__scanLorry(qrJson);
            }
        }
    }, LORRY_ID);

    await page.waitForTimeout(2000);

    // If odometer modal opens, fill ODO reading
    console.log("Filling Odometer in modal...");
    const odoInput = await page.$('input[placeholder*="Contoh: 95671"]');
    if (odoInput) {
        await page.evaluate(() => {
            window.__setTutorialStep(
                '1 / 6',
                'Masukkan Bacaan Odometer: 95,671 km',
                '确认仪表盘初始里程表读数'
            );
        });
        await odoInput.fill('95671');
        await page.waitForTimeout(1500);

        // Click Sahkan / Confirm button
        const confirmOdoBtn = await page.$('button:has-text("SAHKAN & MULA SYIF")');
        if (confirmOdoBtn) {
            await tapElement('button:has-text("SAHKAN & MULA SYIF")', 'Confirm Odometer Start Shift');
        }
    } else {
        // Direct bind DB fallback if modal was bypassed
        await supabaseAdmin.from('lorries').update({
            driver_id: DRIVER_UID,
            driver_name: 'Max Tan',
            status: 'In-Use'
        }).eq('id', LORRY_ID);
        await page.reload();
        await page.waitForTimeout(3000);
    }

    await page.waitForTimeout(2500);

    // ==========================================
    // STEP 2: REVIEW 10-DROP TRIP
    // ==========================================
    console.log("Executing Step 2: Review 10 Drops...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '2 / 6',
            'Semak Trip Hari Ini: 10 Drops (Taiping)',
            '步骤 2: 查阅今日出车行程，共10个客户送货点'
        );
    });
    await page.waitForTimeout(2000);

    // Scroll down to show drop points list
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    // ==========================================
    // STEP 3: OPEN DROP 1 (KEDAI PLASTIK TAIPING)
    // ==========================================
    console.log("Executing Step 3: Open Drop 1...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '3 / 6',
            'Tiba di Lokasi: Buka Drop 1 (Kedai Plastik)',
            '步骤 3: 抵达首个客户现场，展开第一单签收'
        );
    });
    await page.waitForTimeout(2000);

    // Find first order card and click "SAHKAN HANTARAN" or the order card
    const confirmDropBtn = await page.$('button:has-text("SAHKAN HANTARAN")');
    if (confirmDropBtn) {
        await tapElement('button:has-text("SAHKAN HANTARAN")', 'Open Sahkan Hantaran Modal');
    } else {
        // Tap on the first drop card
        const dropCard = await page.$('.border.rounded-2xl:has-text("DO-MAX-260919-001")');
        if (dropCard) {
            await dropCard.click();
        }
    }
    await page.waitForTimeout(2500);

    // ==========================================
    // STEP 4: UPLOAD DUAL POD PHOTOS (DO & GOODS)
    // ==========================================
    console.log("Executing Step 4: Dual Photo Upload...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '4 / 6',
            'Wajib 2 Gambar: 1. DO Bercop  2. Barang Kedai',
            '步骤 4: 务必拍摄双照片：1. 盖章签收单  2. 现场货物'
        );
    });
    await page.waitForTimeout(2200);

    // Inject the DO and Cargo photos directly into React state
    const doBase64 = createMockImageBase64('do', 'DO-MAX-260919-001', 'Kedai Plastik Taiping');
    const prodBase64 = createMockImageBase64('goods', 'Cargo Drop 1', 'Taiping');

    await page.evaluate(({ doImg, prodImg }) => {
        if (window.__driverDeliveryHooks) {
            window.__driverDeliveryHooks.setUnloadPhotos(
                doImg,
                prodImg,
                'Barang diserahkan kepada Encik Tan di kaunter. Cop & tandatangan lengkap.'
            );
        }
    }, { doImg: doBase64, prodImg: prodBase64 });

    // Show simulated camera taps
    await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        const camBtn = Array.from(buttons).find(b => b.innerText.includes('Kamera'));
        if (camBtn) {
            const r = camBtn.getBoundingClientRect();
            window.__showTouch(r.x + r.width / 2, r.y + r.height / 2);
        }
    });
    await page.waitForTimeout(2200);

    // Scroll down inside the modal to show photos and note
    await page.evaluate(() => {
        const modalBody = document.querySelector('.fixed.inset-0 .overflow-y-auto');
        if (modalBody) {
            modalBody.scrollBy({ top: 320, behavior: 'smooth' });
        }
    });
    await page.waitForTimeout(2500);

    // ==========================================
    // STEP 5: CONFIRM AND SUBMIT DROP 1
    // ==========================================
    console.log("Executing Step 5: Submit Drop 1...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '5 / 6',
            'Ketik SAHKAN HANTARAN (Drop Selesai)',
            '步骤 5: 点击确认送达，系统自动归档并记入提成',
            true
        );
    });
    await page.waitForTimeout(2000);

    // Tap submit button in modal
    const submitUnloadBtn = await page.$('button:has-text("SAHKAN HANTARAN")');
    if (submitUnloadBtn) {
        const r = await submitUnloadBtn.boundingBox();
        if (r) {
            await page.evaluate(({ x, y }) => window.__showTouch(x, y), { x: r.x + r.width / 2, y: r.y + r.height / 2 });
            await page.waitForTimeout(200);
        }
        await page.evaluate(() => {
            if (window.__driverDeliveryHooks) {
                window.__driverDeliveryHooks.confirmUnload();
            }
        });
    }

    // Direct database update to guarantee Drop 1 is Delivered on screen
    await supabaseAdmin.from('sales_orders').update({
        status: 'Delivered',
        pod_photo_url: 'https://kdahubyhwndgyloaljak.supabase.co/storage/v1/object/public/work-photos/mock_do.jpg',
        pod_timestamp: new Date().toISOString(),
        notes: '[19/09 09:30] Barang diserahkan kepada Encik Tan di kaunter. Cop lengkap.'
    }).eq('order_number', 'DO-MAX-260919-001');

    await page.waitForTimeout(3000);

    // Scroll back to top to view completed drop badge
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    // ==========================================
    // STEP 6: END SHIFT & UNBIND LORRY
    // ==========================================
    console.log("Executing Step 6: End Shift...");
    await page.evaluate(() => {
        window.__setTutorialStep(
            '6 / 6',
            'Selesai Tugasan: Tamat Syif & Pulang Lori',
            '步骤 6: 一日行程完毕，点击结束当班并交还货车',
            true
        );
    });
    await page.waitForTimeout(2500);

    // Tap Tamat Syif button
    const endShiftBtn = await page.$('button:has-text("TAMAT SYIF")');
    if (endShiftBtn) {
        await tapElement('button:has-text("TAMAT SYIF")', 'Tap Tamat Syif / End Shift');
        await page.waitForTimeout(2000);
    }

    // Outro banner
    await page.evaluate(() => {
        window.__setTutorialStep(
            'SELESAI ✅',
            'Tahniah! Panduan Penghantaran Selesai',
            '教程完毕：安全驾驶，每日出车顺顺利利！',
            true
        );
    });
    await page.waitForTimeout(3500);

    // Finish recording
    console.log("Closing browser and finalizing video file...");
    await page.close();
    await context.close();
    await browser.close();

    // Rename recorded file to public/videos/driver_delivery_tutorial.webm
    const files = fs.readdirSync(rawDir);
    const videoFile = files.find(f => f.endsWith('.webm'));
    if (videoFile) {
        const src = path.join(rawDir, videoFile);
        const dest = path.resolve('public/videos/driver_delivery_tutorial.webm');
        fs.copyFileSync(src, dest);
        console.log(`✅ Video 1 generated successfully: ${dest} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
    } else {
        console.error("No webm video found in raw directory!");
    }
}

recordDeliveryTutorial().catch(err => {
    console.error("Recording error:", err);
    process.exit(1);
});
