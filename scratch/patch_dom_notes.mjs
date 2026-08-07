import fs from 'fs';

const file = 'src/pages/DeliveryOrderManagement.tsx';

if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    
    // Normalize newlines to avoid CRLF issues
    content = content.replace(/\r\n/g, '\n');

    // 1. Patch Lanes View (around line 2928)
    const target1 = '<div className="text-[10px] text-slate-500 line-clamp-1">{order.deliveryAddress}</div>';
    const replacement1 = target1 + '\n                                                            {order.notes && (\n                                                                <div className="text-[10px] text-amber-500/80 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 mt-1 break-all">\n                                                                    📝 {order.notes}\n                                                                </div>\n                                                            )}';
    
    if (content.includes(target1)) {
        content = content.replace(target1, replacement1);
        console.log("Successfully patched Lanes View Card with notes.");
    } else {
        console.warn("Could not find target1 for Lanes View");
    }

    // 2. Patch Kanban View (around line 3187)
    // To make it precise, let's find the closing Del div block and replace it
    const target2 = `                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[9px] font-black text-blue-500/50 uppercase tracking-tighter">🚚 Del:</span>
                                                                        <span className="text-[10px] text-blue-400 font-black">{formatDateDMY(order.deadline) || "No Date"}</span>
                                                                    </div>
                                                                </div>
                                                            </div>`;
    const replacement2 = target2 + `\n\n                                                            {order.notes && (
                                                                <div className="text-[10px] text-amber-500/80 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 mb-3 break-all font-medium leading-relaxed">
                                                                    📝 {order.notes}
                                                                </div>
                                                            )}`;
    
    if (content.includes(target2)) {
        content = content.replace(target2, replacement2);
        console.log("Successfully patched Kanban View Card with notes.");
    } else {
        console.warn("Could not find target2 for Kanban View");
    }

    // 3. Patch List View (around line 3329)
    const target3 = `<div className="text-sm text-slate-200 truncate">{order.deliveryAddress || '-'}</div>`;
    const replacement3 = target3 + `\n                                                    {order.notes && (\n                                                        <div className="text-[10px] text-amber-400 mt-0.5 truncate" title={order.notes}>\n                                                            📝 {order.notes}\n                                                        </div>\n                                                    )}`;
    
    if (content.includes(target3)) {
        content = content.replace(target3, replacement3);
        console.log("Successfully patched List View row with notes.");
    } else {
        console.warn("Could not find target3 for List View");
    }

    fs.writeFileSync(file, content, 'utf-8');
} else {
    console.error("File not found");
}
