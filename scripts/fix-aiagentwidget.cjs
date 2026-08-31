const fs = require('fs');
let code = fs.readFileSync('src/components/AIAgentWidget.tsx', 'utf8');

// Add import i18next
if (!code.includes("import i18next from 'i18next'")) {
    code = code.replace(/import \{ useTranslation \} from "react-i18next";/g, 'import { useTranslation } from "react-i18next";\nimport i18next from "i18next";');
}

// Global replace of t( to i18next.t(
code = code.replace(/\bt\('ui_text/g, "i18next.t('ui_text");

fs.writeFileSync('src/components/AIAgentWidget.tsx', code);
console.log('Fixed AIAgentWidget!');
