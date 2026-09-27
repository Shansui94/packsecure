const fs = require('fs');
const QRCode = require('qrcode');
const path = require('path');

const rootDir = __dirname ? path.join(__dirname, '..') : process.cwd();
const htmlFile = path.join(rootDir, 'scan_qr_code.html');
const workspacePng = path.join(rootDir, 'whatsapp_qr.png');
const artifactPng = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\fdd87612-1449-40cb-b4ea-cba85f167082\\whatsapp_qr.png';

if (fs.existsSync(htmlFile)) {
  const content = fs.readFileSync(htmlFile, 'utf8');
  const match = content.match(/text:\s*"([^"]+)"/);
  if (match) {
    const text = match[1];
    Promise.all([
      QRCode.toFile(workspacePng, text, { width: 360, margin: 2 }),
      QRCode.toFile(artifactPng, text, { width: 360, margin: 2 })
    ]).then(() => {
      console.log('SUCCESS: QR code PNG generated at:');
      console.log(workspacePng);
      console.log(artifactPng);
    }).catch(err => {
      console.error('Error generating QR PNG:', err);
    });
  } else {
    console.log('No QR text found in scan_qr_code.html');
  }
} else {
  console.log('scan_qr_code.html does not exist yet');
}
