import fs from 'fs';

const filePath = 'src/pages/DeliveryOrderManagement.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 确认是否能在文件中匹配到这段代码
const targetSnippet = `<button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id, order.orderNumber); }} className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors" title="Cancel">`;

if (content.includes(targetSnippet)) {
    console.log("Found target snippet. Proceeding to replace...");

    // 我们通过替换包含整个 td 的这一段
    const originalPart = `                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id, order.orderNumber); }} className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors" title="Cancel">
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setReassignOrder(order); setIsReassignModalOpen(true); }} className="p-2 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors" title="Change Driver">
                                                            <UserIcon size={16} />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setSplitOrder(order); setSplitItems({}); setSplitTargetDriverId(''); setSplitTargetDate(''); setIsSplitModalOpen(true); }} className="p-2 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded-md transition-colors" title="Split Order">
                                                            <Scissors size={16} />
                                                        </button>
                                                        {order.status === 'Pending Approval' && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleApproveAmendment(order); }} className="p-2 text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-900/50 rounded-md transition-colors" title="Approve">
                                                                <Zap size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>`;

    const replacementPart = `                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {order.status === 'Cancelled' ? (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleRestoreToLoaded(order); }}
                                                                    className="px-2.5 py-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                                                    title="Restore to Loaded status under the assigned driver"
                                                                >
                                                                    <RotateCcw size={13} /> Re-Activate (Loaded)
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleResetToNew(order); }}
                                                                    className="px-2.5 py-1.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                                                    title="Reset to New status and clear driver"
                                                                >
                                                                    <RefreshCw size={13} /> Reset to New
                                                                </button>
                                                            </>
                                                        ) : order.status === 'Delivered' ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRestoreToLoaded(order); }}
                                                                className="px-2.5 py-1.5 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-300 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                                                title="Revert back to Loaded status (Undeliver)"
                                                            >
                                                                <RotateCcw size={13} /> Revert to Loaded
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id, order.orderNumber); }} className="p-2 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors" title="Cancel">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); setReassignOrder(order); setIsReassignModalOpen(true); }} className="p-2 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-md transition-colors" title="Change Driver">
                                                                    <UserIcon size={16} />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); setSplitOrder(order); setSplitItems({}); setSplitTargetDriverId(''); setSplitTargetDate(''); setIsSplitModalOpen(true); }} className="p-2 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded-md transition-colors" title="Split Order">
                                                                    <Scissors size={16} />
                                                                </button>
                                                                {order.status === 'Pending Approval' && (
                                                                    <button onClick={(e) => { e.stopPropagation(); handleApproveAmendment(order); }} className="p-2 text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-900/50 rounded-md transition-colors" title="Approve">
                                                                        <Zap size={16} />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>`;

    // 考虑到 Windows 下的 \r\n 换行，我们先把所有 \r\n 转为 \n 再执行替换，最后再写回。
    content = content.replace(/\r\n/g, '\n');
    const originalNormalized = originalPart.replace(/\r\n/g, '\n');
    const replacementNormalized = replacementPart.replace(/\r\n/g, '\n');

    if (content.includes(originalNormalized)) {
        content = content.replace(originalNormalized, replacementNormalized);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log("Replacement applied successfully!");
    } else {
        // 如果依然无法完整匹配，我们进行部分正则替换或者更细粒度替换
        console.log("Failed to match full block. Attempting line-by-line or regex replacement...");
        
        // 尝试用更精简的匹配
        const startMarker = `<td className="p-4 text-right">`;
        const endMarker = `</td>`;
        
        // 查找包含 targetSnippet 的那一块 td 单元格进行替换
        // 寻找在 targetSnippet 之前最近的 startMarker 和之后最近的 endMarker 
        const targetIdx = content.indexOf(targetSnippet);
        if (targetIdx !== -1) {
            const tdStart = content.lastIndexOf(startMarker, targetIdx);
            const tdEnd = content.indexOf(endMarker, targetIdx) + endMarker.length;
            
            if (tdStart !== -1 && tdEnd !== -1) {
                const head = content.slice(0, tdStart);
                const tail = content.slice(tdEnd);
                content = head + replacementNormalized + tail;
                fs.writeFileSync(filePath, content, 'utf-8');
                console.log("Regex-like block replacement applied successfully!");
            } else {
                console.error("Could not find start or end marker around snippet.");
            }
        } else {
            console.error("Could not find targetSnippet in file.");
        }
    }
} else {
    console.error("Target snippet not found in file. Perhaps already replaced or format changed.");
}
