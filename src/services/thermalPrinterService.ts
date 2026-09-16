/**
 * Packsecure OS - Thermal Label Printer Service
 * 针对 SoonMark M4201 及通用 TSPL 热敏标签打印机的直连驱动服务
 * 支持：
 * 1. Web Serial (USB 串口直连 - 电脑工位)
 * 2. Web Bluetooth (BLE 蓝牙直连 - 平板与手机工位)
 * 3. TSPL2 矢量指令生成 (高速度、条码与 QR 码硬件级渲染)
 * 4. Canvas 高清位图转 TSPL 指令 (100% 所见即所得，兼容任何固件字库)
 * 5. 浏览器标准打印降级回退 (System Print Dialog Fallback)
 */

export interface LabelData {
    sku: string;
    productName: string;
    machineCode: string;
    operatorName?: string;
    operatorId?: string;
    lotNo: string;
    timestamp: string;
    rolls?: number;
    layer?: string;
    material?: string;
    size?: string;
    color?: string;
    yieldCount?: number;
    barcode?: string;
    qrCode?: string;
    note?: string;
}

export type ConnectionType = 'serial' | 'bluetooth' | 'none';

export interface PrinterSettings {
    widthMm: number;
    heightMm: number;
    gapMm: number;
    density: number; // 1-15 (default 8)
    speed: number;   // 2-6 (default 4)
    autoPrintOnCount: boolean;
    printMode: 'tspl' | 'bitmap';
    copies: number;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
    widthMm: 100,
    heightMm: 100,
    gapMm: 2,
    density: 8,
    speed: 4,
    autoPrintOnCount: false,
    printMode: 'tspl',
    copies: 1
};

// 常见热敏打印机 BLE 服务与特征 UUID 列表
const BLE_PRINT_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb', // 标准中式热敏打印机服务
    '0000ffe0-0000-1000-8000-00805f9b34fb', // 经典透明传输 UART
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC 串口透传
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // 速马 / 芯烨常见 BLE 服务
    '0000ff00-0000-1000-8000-00805f9b34fb', // 通用透传服务
];

class ThermalPrinterService {
    private connectionType: ConnectionType = 'none';
    private deviceName: string = '';
    private serialPort: any = null;
    private serialWriter: any = null;
    private bluetoothDevice: any = null;
    private bluetoothCharacteristic: any = null;
    private listeners: Set<(status: { connected: boolean; type: ConnectionType; name: string }) => void> = new Set();

    private settings: PrinterSettings = DEFAULT_PRINTER_SETTINGS;

    constructor() {
        this.loadSettings();
    }

    // -------------------------------------------------------------
    // 设置管理 (Settings Persistence)
    // -------------------------------------------------------------
    public getSettings(): PrinterSettings {
        return { ...this.settings };
    }

    public updateSettings(newSettings: Partial<PrinterSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        try {
            localStorage.setItem('packsecure_thermal_printer_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save printer settings:', e);
        }
    }

    private loadSettings() {
        try {
            const saved = localStorage.getItem('packsecure_thermal_printer_settings');
            if (saved) {
                this.settings = { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Failed to load printer settings:', e);
        }
    }

    // -------------------------------------------------------------
    // 状态订阅 (Status Event Listener)
    // -------------------------------------------------------------
    public subscribe(callback: (status: { connected: boolean; type: ConnectionType; name: string }) => void) {
        this.listeners.add(callback);
        // 立即触发一次当前状态
        callback(this.getStatus());
        return () => this.listeners.delete(callback);
    }

    private notifyStatus() {
        const status = this.getStatus();
        this.listeners.forEach(cb => {
            try { cb(status); } catch (e) { console.error(e); }
        });
    }

    public getStatus() {
        return {
            connected: this.connectionType !== 'none',
            type: this.connectionType,
            name: this.deviceName
        };
    }

    // 检查浏览器是否支持 Web Serial
    public isSerialSupported(): boolean {
        return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    // 检查浏览器是否支持 Web Bluetooth
    public isBluetoothSupported(): boolean {
        return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    }

    // -------------------------------------------------------------
    // Web Serial 连接 (USB 串口连接，常用于工位 PC / 一体机)
    // -------------------------------------------------------------
    public async connectSerial(baudRate: number = 9600): Promise<boolean> {
        if (!this.isSerialSupported()) {
            throw new Error('当前浏览器不支持 Web Serial 串口通信，请使用 Chrome 或 Edge 浏览器。');
        }

        try {
            await this.disconnect();

            const port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate });

            this.serialPort = port;
            this.connectionType = 'serial';
            this.deviceName = 'SoonMark M4201 (USB/COM)';

            // 监听断开
            port.addEventListener('disconnect', () => {
                this.disconnect();
            });

            this.notifyStatus();
            return true;
        } catch (err: any) {
            console.error('[Printer] Serial connection failed:', err);
            this.disconnect();
            throw err;
        }
    }

    // -------------------------------------------------------------
    // Web Bluetooth 连接 (BLE 蓝牙无线直连，常用于平板/手机工位)
    // -------------------------------------------------------------
    public async connectBluetooth(): Promise<boolean> {
        if (!this.isBluetoothSupported()) {
            throw new Error('当前浏览器不支持 Web Bluetooth 蓝牙通信，请在 Chrome 中打开或确保在 HTTPS / localhost 环境下运行。');
        }

        try {
            await this.disconnect();

            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: BLE_PRINT_SERVICES
            });

            if (!device || !device.gatt) {
                throw new Error('未选择蓝牙设备。');
            }

            this.deviceName = device.name || 'SoonMark M4201 (BT)';

            const server = await device.gatt.connect();

            // 自动检索可写特征值
            let writableChar: any = null;
            for (const serviceUuid of BLE_PRINT_SERVICES) {
                try {
                    const service = await server.getPrimaryService(serviceUuid);
                    const characteristics = await service.getCharacteristics();
                    for (const char of characteristics) {
                        if (char.properties.write || char.properties.writeWithoutResponse) {
                            writableChar = char;
                            break;
                        }
                    }
                    if (writableChar) break;
                } catch {
                    // 当前服务不存在，继续尝试下一个
                }
            }

            // 若已知服务未匹配，则尝试扫描所有主服务
            if (!writableChar) {
                try {
                    const services = await server.getPrimaryServices();
                    for (const service of services) {
                        const characteristics = await service.getCharacteristics();
                        for (const char of characteristics) {
                            if (char.properties.write || char.properties.writeWithoutResponse) {
                                writableChar = char;
                                break;
                            }
                        }
                        if (writableChar) break;
                    }
                } catch (scanErr) {
                    console.warn('[Printer] Failed to get all primary services:', scanErr);
                }
            }

            if (!writableChar) {
                throw new Error('已连接到蓝牙设备，但未找到可写入数据的打印服务接口。');
            }

            this.bluetoothDevice = device;
            this.bluetoothCharacteristic = writableChar;
            this.connectionType = 'bluetooth';

            device.addEventListener('gattserverdisconnected', () => {
                this.disconnect();
            });

            this.notifyStatus();
            return true;
        } catch (err: any) {
            console.error('[Printer] Bluetooth connection failed:', err);
            this.disconnect();
            throw err;
        }
    }

    // -------------------------------------------------------------
    // 安全断开连接 (Disconnect)
    // -------------------------------------------------------------
    public async disconnect() {
        if (this.serialWriter) {
            try {
                await this.serialWriter.close();
            } catch {}
            this.serialWriter = null;
        }

        if (this.serialPort) {
            try {
                await this.serialPort.close();
            } catch {}
            this.serialPort = null;
        }

        if (this.bluetoothDevice && this.bluetoothDevice.gatt?.connected) {
            try {
                this.bluetoothDevice.gatt.disconnect();
            } catch {}
        }
        this.bluetoothDevice = null;
        this.bluetoothCharacteristic = null;

        this.connectionType = 'none';
        this.deviceName = '';
        this.notifyStatus();
    }

    // -------------------------------------------------------------
    // 原始字节写入通道 (Low-Level Chunked Data Sender)
    // -------------------------------------------------------------
    public async sendRawBytes(bytes: Uint8Array): Promise<void> {
        if (this.connectionType === 'none') {
            throw new Error('未连接打印机，请先点击连接。');
        }

        if (this.connectionType === 'serial') {
            if (!this.serialPort || !this.serialPort.writable) {
                throw new Error('串口未处于可写状态。');
            }
            const writer = this.serialPort.writable.getWriter();
            try {
                // USB 串口传输速度较快，512 字节分片
                const chunkSize = 512;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.slice(i, i + chunkSize);
                    await writer.write(chunk);
                }
            } finally {
                writer.releaseLock();
            }
        } else if (this.connectionType === 'bluetooth') {
            if (!this.bluetoothCharacteristic) {
                throw new Error('蓝牙写入特征值失效。');
            }
            // 蓝牙 BLE MTU 限制，100 字节分片并带有 20ms 延时，杜绝打印机芯片丢包
            const chunkSize = 100;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.slice(i, i + chunkSize);
                if (this.bluetoothCharacteristic.properties.writeWithoutResponse) {
                    await this.bluetoothCharacteristic.writeValueWithoutResponse(chunk);
                } else {
                    await this.bluetoothCharacteristic.writeValue(chunk);
                }
                // 微小间隔防止硬件缓冲区溢出
                if (i + chunkSize < bytes.length) {
                    await new Promise(res => setTimeout(res, 20));
                }
            }
        }
    }

    // -------------------------------------------------------------
    // TSPL 文本指令生成器 (TSPL Command Generator)
    // -------------------------------------------------------------
    public buildTsplCommands(data: LabelData, settings: PrinterSettings = this.settings): string {
        const { widthMm, heightMm, gapMm, density, speed, copies } = settings;

        // TSPL 指令行均以 \r\n 结尾
        let cmd = '';
        cmd += `SIZE ${widthMm} mm, ${heightMm} mm\r\n`;
        cmd += `GAP ${gapMm} mm, 0 mm\r\n`;
        cmd += `SPEED ${speed}\r\n`;
        cmd += `DENSITY ${density}\r\n`;
        cmd += `DIRECTION 1\r\n`;
        cmd += `REFERENCE 0,0\r\n`;
        cmd += `OFFSET 0 mm\r\n`;
        cmd += `SET PEEL OFF\r\n`;
        cmd += `SET CUTTER OFF\r\n`;
        cmd += `SET TEAR ON\r\n`;
        cmd += `CLS\r\n`;

        // 标签外边框 (203dpi: 8 dots/mm)
        const maxX = Math.floor((widthMm - 4) * 8);
        const maxY = Math.floor((heightMm - 4) * 8);
        cmd += `BOX 20, 20, ${maxX}, ${maxY}, 4\r\n`;

        // 标头：PACKSECURE OS 生产合格标签
        cmd += `TEXT 40, 40, "3", 0, 1, 1, "PACKSECURE OS"\r\n`;
        cmd += `TEXT 500, 40, "3", 0, 1, 1, "[ QC PASS ]"\r\n`;
        cmd += `BAR 20, 90, ${maxX - 20}, 3\r\n`;

        // 产品 SKU 与描述
        const displaySku = (data.sku || 'BW-GENERAL').slice(0, 32);
        cmd += `TEXT 40, 110, "3", 0, 1, 1, "SKU: ${displaySku}"\r\n`;

        const nameLine = (data.productName || 'BUBBLE WRAP').slice(0, 36);
        cmd += `TEXT 40, 155, "2", 0, 1, 1, "DESC: ${nameLine}"\r\n`;

        // 分割线
        cmd += `BAR 20, 200, ${maxX - 20}, 2\r\n`;

        // 机台、操作员、工位
        const machine = data.machineCode || 'N1-M01';
        const operator = data.operatorName || data.operatorId || 'OP-AUTO';
        cmd += `TEXT 40, 220, "2", 0, 1, 1, "MACHINE: ${machine}"\r\n`;
        cmd += `TEXT 420, 220, "2", 0, 1, 1, "OPERATOR: ${operator}"\r\n`;

        // 规格 (Layer, Material, Size, Rolls)
        const specText = `${data.layer || 'Single'} | ${data.material || 'Clear'} | ${data.size || '100cm'}`;
        const rollsText = `Rolls: ${data.rolls || 1}  Color: ${data.color || 'TRP'}`;
        cmd += `TEXT 40, 260, "2", 0, 1, 1, "SPEC: ${specText}"\r\n`;
        cmd += `TEXT 420, 260, "2", 0, 1, 1, "${rollsText}"\r\n`;

        // 生产批号 Lot No 与时间戳
        cmd += `TEXT 40, 300, "2", 0, 1, 1, "LOT NO: ${data.lotNo}"\r\n`;
        cmd += `TEXT 420, 300, "2", 0, 1, 1, "DATE: ${data.timestamp.slice(0, 16)}"\r\n`;

        // 分割线
        cmd += `BAR 20, 345, ${maxX - 20}, 2\r\n`;

        // Code 128 条形码 (左下角)
        // BARCODE X, Y, "CodeType", Height, HumanReadable, Rotation, Narrow, Wide, "Content"
        const barcodeContent = data.barcode || data.sku;
        cmd += `BARCODE 40, 370, "128", 75, 1, 0, 2, 4, "${barcodeContent}"\r\n`;

        // QR Code 二维码 (右下角，用于扫码入库 Live Stock)
        // QRCODE X, Y, ECC_Level, CellWidth, Mode, Rotation, "Content"
        const qrContent = data.qrCode || `PS|${data.sku}|${data.lotNo}|${data.machineCode}|${data.timestamp}`;
        cmd += `QRCODE 540, 370, L, 5, A, 0, "${qrContent}"\r\n`;
        cmd += `TEXT 540, 490, "1", 0, 1, 1, "INVENTORY SCAN"\r\n`;

        // 底部打完走纸
        cmd += `PRINT ${copies}, 1\r\n`;

        return cmd;
    }

    // -------------------------------------------------------------
    // Canvas 位图转 TSPL 指令 (所见即所得高清模式，支持中文与自定义图形)
    // -------------------------------------------------------------
    public canvasToTsplBitmap(canvas: HTMLCanvasElement, settings: PrinterSettings = this.settings): Uint8Array {
        const { widthMm, heightMm, gapMm, density, speed, copies } = settings;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get canvas 2d context');

        const width = canvas.width;
        const height = canvas.height;
        const widthBytes = Math.ceil(width / 8);

        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        // TSPL BITMAP 指令：每行 widthBytes 个字节，共 height 行
        const bitmapData = new Uint8Array(widthBytes * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];
                const a = pixels[idx + 3];

                // 计算灰度值并设定阈值 (0-255)
                const isBlack = a > 128 && (0.299 * r + 0.587 * g + 0.114 * b) < 160;

                if (isBlack) {
                    const byteIdx = y * widthBytes + Math.floor(x / 8);
                    const bitPos = 7 - (x % 8);
                    bitmapData[byteIdx] |= (1 << bitPos);
                }
            }
        }

        // 拼接 TSPL 指令头与指令尾
        let headerStr = '';
        headerStr += `SIZE ${widthMm} mm, ${heightMm} mm\r\n`;
        headerStr += `GAP ${gapMm} mm, 0 mm\r\n`;
        headerStr += `SPEED ${speed}\r\n`;
        headerStr += `DENSITY ${density}\r\n`;
        headerStr += `DIRECTION 1\r\n`;
        headerStr += `REFERENCE 0,0\r\n`;
        headerStr += `CLS\r\n`;
        headerStr += `BITMAP 0,0,${widthBytes},${height},0,`;

        const footerStr = `\r\nPRINT ${copies}, 1\r\n`;

        const encoder = new TextEncoder();
        const headerBytes = encoder.encode(headerStr);
        const footerBytes = encoder.encode(footerStr);

        // 合并完整 ArrayBuffer
        const totalLength = headerBytes.length + bitmapData.length + footerBytes.length;
        const result = new Uint8Array(totalLength);

        result.set(headerBytes, 0);
        result.set(bitmapData, headerBytes.length);
        result.set(footerBytes, headerBytes.length + bitmapData.length);

        return result;
    }

    // -------------------------------------------------------------
    // 渲染标签至 Canvas (用于预览与高清位图输出)
    // -------------------------------------------------------------
    public renderLabelToCanvas(canvas: HTMLCanvasElement, data: LabelData, settings: PrinterSettings = this.settings) {
        const { widthMm, heightMm } = settings;
        // 203 DPI: 8 dots/mm
        const w = Math.floor(widthMm * 8);
        const h = Math.floor(heightMm * 8);

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 白色背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);

        // 黑色线条与文字
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;

        // 外边框
        ctx.strokeRect(16, 16, w - 32, h - 32);

        // 顶部标头
        ctx.font = 'bold 30px "Arial", sans-serif';
        ctx.fillText('PACKSECURE OS', 36, 60);

        // 合格印章框
        ctx.strokeRect(w - 230, 28, 190, 48);
        ctx.font = 'bold 24px "Arial", sans-serif';
        ctx.fillText('合格品 PASS', w - 215, 62);

        // 分割线 1
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(16, 90);
        ctx.lineTo(w - 16, 90);
        ctx.stroke();

        // 产品 SKU 与 名称
        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.fillText(`SKU: ${data.sku || 'BW-GENERAL'}`, 36, 130);

        ctx.font = 'bold 22px "Arial", sans-serif';
        ctx.fillText(`品名: ${data.productName || '气泡膜 (Bubble Wrap)'}`, 36, 168);

        // 分割线 2
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(16, 195);
        ctx.lineTo(w - 16, 195);
        ctx.stroke();

        // 详细信息网格 (左列 & 右列)
        ctx.font = '20px "Arial", sans-serif';
        const col1X = 36;
        const col2X = Math.floor(w / 2) + 10;

        ctx.fillText(`生产机台: ${data.machineCode || 'N1-M01'}`, col1X, 230);
        ctx.fillText(`操作人员: ${data.operatorName || data.operatorId || 'OP-01'}`, col2X, 230);

        const specDesc = `${data.layer || 'Single'} | ${data.material || 'Clear'} | ${data.size || '100cm'}`;
        ctx.fillText(`规格属性: ${specDesc}`, col1X, 268);
        ctx.fillText(`包装卷数: ${data.rolls || 1} Rolls (${data.color || 'TRP'})`, col2X, 268);

        ctx.fillText(`生产批号: ${data.lotNo}`, col1X, 306);
        ctx.fillText(`生产时间: ${data.timestamp.slice(0, 16)}`, col2X, 306);

        // 分割线 3
        ctx.beginPath();
        ctx.moveTo(16, 335);
        ctx.lineTo(w - 16, 335);
        ctx.stroke();

        // 底部条形码模拟与文本
        const barcodeVal = data.barcode || data.sku;
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText(`* ${barcodeVal} *`, 36, 440);

        // 条形码线条绘制 (粗细黑条交替示意)
        const barStartX = 36;
        const barY = 355;
        const barH = 65;
        let curX = barStartX;
        for (let i = 0; i < barcodeVal.length; i++) {
            const charCode = barcodeVal.charCodeAt(i);
            const barW = (charCode % 3) + 2;
            ctx.fillRect(curX, barY, barW, barH);
            curX += barW + ((charCode % 2) + 2);
            if (curX > w / 2 - 20) break;
        }

        // 右下角 QR Code 提示框
        const qrBoxX = w - 190;
        const qrBoxY = 350;
        ctx.lineWidth = 2;
        ctx.strokeRect(qrBoxX, qrBoxY, 150, 150);

        // QR 内部绘制简单图案
        ctx.fillRect(qrBoxX + 15, qrBoxY + 15, 35, 35);
        ctx.fillRect(qrBoxX + 100, qrBoxY + 15, 35, 35);
        ctx.fillRect(qrBoxX + 15, qrBoxY + 100, 35, 35);
        ctx.fillRect(qrBoxX + 60, qrBoxY + 60, 30, 30);

        ctx.font = 'bold 16px "Arial", sans-serif';
        ctx.fillText('仓库扫码入库', qrBoxX + 25, qrBoxY + 140);
    }

    // -------------------------------------------------------------
    // 执行打印主入口 (Unified Print Execution)
    // -------------------------------------------------------------
    public async printRollLabel(data: LabelData, customSettings?: Partial<PrinterSettings>): Promise<void> {
        const activeSettings: PrinterSettings = { ...this.settings, ...customSettings };

        // 1. 如果已通过 USB 或蓝牙直连，使用直连通道免弹窗极速打印
        if (this.connectionType !== 'none') {
            if (activeSettings.printMode === 'bitmap') {
                // Canvas 高清位图模式
                const canvas = document.createElement('canvas');
                this.renderLabelToCanvas(canvas, data, activeSettings);
                const bytes = this.canvasToTsplBitmap(canvas, activeSettings);
                await this.sendRawBytes(bytes);
            } else {
                // 原生 TSPL 指令模式 (极快)
                const cmdStr = this.buildTsplCommands(data, activeSettings);
                const encoder = new TextEncoder();
                const bytes = encoder.encode(cmdStr);
                await this.sendRawBytes(bytes);
            }
            return;
        }

        // 2. 如果未建立直连，降级回退到浏览器标准系统打印窗口
        console.warn('[Printer] Direct connection not established, falling back to browser window.print');
        this.printViaBrowserFallback(data, activeSettings);
    }

    // -------------------------------------------------------------
    // 打印测试页 (Test Print)
    // -------------------------------------------------------------
    public async printTestPage(): Promise<void> {
        const now = new Date();
        const testData: LabelData = {
            sku: 'BW-SL-CLR-100Mx100CMx1ROLL-TRP',
            productName: '单层透明 100M x 100CM (测试标签)',
            machineCode: 'SOONMARK-M4201',
            operatorName: 'System Test',
            operatorId: 'TEST-01',
            lotNo: `TEST-${now.toISOString().slice(0, 10).replace(/-/g, '')}`,
            timestamp: now.toISOString(),
            rolls: 1,
            layer: 'Single Layer',
            material: 'Clear',
            size: '100cm',
            color: 'Transparent',
            yieldCount: 1,
            barcode: 'PACKSECURE-TEST-2026',
            qrCode: 'PACKSECURE-SOONMARK-M4201-OK'
        };

        await this.printRollLabel(testData);
    }

    // -------------------------------------------------------------
    // 浏览器标准打印降级实现 (Browser Print Fallback)
    // -------------------------------------------------------------
    private printViaBrowserFallback(data: LabelData, settings: PrinterSettings) {
        const printWindow = window.open('', '_blank', 'width=450,height=500');
        if (!printWindow) {
            alert('请允许弹出窗口以进行标签打印。');
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Print Label - ${data.sku}</title>
                <style>
                    @page {
                        size: ${settings.widthMm}mm ${settings.heightMm}mm;
                        margin: 0;
                    }
                    body {
                        font-family: system-ui, -apple-system, sans-serif;
                        margin: 0;
                        padding: 8px;
                        background: #fff;
                        color: #000;
                        box-sizing: border-box;
                    }
                    .label-card {
                        border: 3px solid #000;
                        padding: 10px;
                        height: calc(${settings.heightMm}mm - 20px);
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #000;
                        padding-bottom: 6px;
                    }
                    .title { font-weight: 900; font-size: 16px; }
                    .badge { border: 2px solid #000; padding: 2px 6px; font-weight: bold; font-size: 12px; }
                    .sku { font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 6px; }
                    .desc { font-size: 12px; margin-bottom: 6px; border-bottom: 1px dashed #666; padding-bottom: 4px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
                    .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #000; padding-top: 6px; }
                    .barcode { font-family: monospace; font-weight: bold; font-size: 13px; }
                </style>
            </head>
            <body>
                <div class="label-card">
                    <div class="header">
                        <span class="title">PACKSECURE OS</span>
                        <span class="badge">合格品 PASS</span>
                    </div>
                    <div class="sku">SKU: ${data.sku}</div>
                    <div class="desc">${data.productName}</div>
                    <div class="grid">
                        <div>机台: <strong>${data.machineCode}</strong></div>
                        <div>人员: <strong>${data.operatorName || data.operatorId || 'OP'}</strong></div>
                        <div>规格: ${data.layer || ''} ${data.material || ''}</div>
                        <div>卷数: ${data.rolls || 1} Roll (${data.color || ''})</div>
                        <div>批号: ${data.lotNo}</div>
                        <div>时间: ${data.timestamp.slice(0, 16)}</div>
                    </div>
                    <div class="footer">
                        <div class="barcode">|||||||||||||||||||||||<br>${data.barcode || data.sku}</div>
                        <div style="text-align: right; font-size: 10px; font-weight: bold;">[ 扫码入库 ]</div>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    }
}

// 导出单例服务
export const thermalPrinterService = new ThermalPrinterService();
