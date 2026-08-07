import fs from 'fs';

const filePath = 'src/pages/DeliveryOrderManagement.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const targetStr = `                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {order.status === 'Cancelled' ? (`;

const replacementStr = `                                                <td className="p-4 text-right">
                                                    <div className={\`flex items-center justify-end gap-1.5 \${['Cancelled', 'Delivered'].includes(order.status) ? '' : 'opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity'}\`}>
                                                        {order.status === 'Cancelled' ? (`;

content = content.replace(/\r\n/g, '\n');
const targetNorm = targetStr.replace(/\r\n/g, '\n');
const replacementNorm = replacementStr.replace(/\r\n/g, '\n');

if (content.includes(targetNorm)) {
    content = content.replace(targetNorm, replacementNorm);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("Visibility patch applied successfully!");
} else {
    console.error("Could not find visibility target string.");
}
