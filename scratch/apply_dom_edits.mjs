import fs from 'fs';

const filePath = 'c:\\Users\\Max Tan\\Downloads\\Packsecure OS\\packsecure\\src\\pages\\DeliveryOrderManagement.tsx';
let content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');

// 1. Search haystack
const searchHaystackTarget = `function buildTripSearchHaystack(order: SalesOrder, driverName?: string): string {
    const addr = order.deliveryAddress || '';
    const inferredRegion = addr ? determineState(addr) : '';
    return [
        driverName,
        order.orderNumber,
        order.customer,
        order.zone,
        order.trip_origin,
        addr,
        inferredRegion,
        order.notes,
    ]`;

const searchHaystackRepl = `function buildTripSearchHaystack(order: SalesOrder, driverName?: string): string {
    const addr = order.deliveryAddress || '';
    const inferredRegion = addr ? determineState(addr) : '';
    return [
        driverName,
        order.orderNumber,
        order.customer,
        order.zone,
        order.trip_origin,
        addr,
        inferredRegion,
        order.notes,
        order.extracted_do_number || '',
    ]`;

// 2. Helper getExtractedDo
const helperTarget = `function ymdToDmy(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    if (!y || !m || !d) return ymd;
    return \`\${d}/\${m}/\${y}\`;
}`;

const helperRepl = `function ymdToDmy(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    if (!y || !m || !d) return ymd;
    return \`\${d}/\${m}/\${y}\`;
}

function getExtractedDo(order: SalesOrder): string {
    if (order.extracted_do_number) return order.extracted_do_number;
    if (order.notes) {
        const match = order.notes.match(/\\[AI DO:\\s*(.*?)\\]/);
        return match ? match[1] : '';
    }
    return '';
}`;

// 3. fetchData mapping
const mappingTarget = `                    proof_of_load_url: o.proof_of_load_url,
                    pod_photo_url: o.pod_photo_url,
                    pod_signature_url: o.pod_signature_url,
                    pod_signed_by: o.pod_signed_by,
                    pod_timestamp: o.pod_timestamp
                }));
                setOrders(mappedOrders);`;

const mappingRepl = `                    proof_of_load_url: o.proof_of_load_url,
                    pod_photo_url: o.pod_photo_url,
                    pod_signature_url: o.pod_signature_url,
                    pod_signed_by: o.pod_signed_by,
                    pod_timestamp: o.pod_timestamp,
                    extracted_do_number: o.extracted_do_number
                }));
                setOrders(mappedOrders);`;

// 4. Unassigned cards (Kanban)
const unassignedTarget = `                                                        <span className="font-mono text-xs font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                            {order.orderNumber}
                                                        </span>
                                                        {order.deliveryAddress && (
                                                            <span className={\`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider \${getStateColor(determineState(order.deliveryAddress))}\`}>
                                                                {determineState(order.deliveryAddress)}
                                                            </span>
                                                        )}`;

const unassignedRepl = `                                                        <span className="font-mono text-xs font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                            {order.orderNumber}
                                                        </span>
                                                        {getExtractedDo(order) && (
                                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="AI Extracted DO Number">
                                                                DO: {getExtractedDo(order)}
                                                            </span>
                                                        )}
                                                        {order.deliveryAddress && (
                                                            <span className={\`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider \${getStateColor(determineState(order.deliveryAddress))}\`}>
                                                                {determineState(order.deliveryAddress)}
                                                            </span>
                                                        )}`;

// 5. Assigned planner card (Kanban)
const plannerTarget = `                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-[10px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                                    {order.orderNumber}
                                                                </span>
                                                                {order.deliveryAddress && (
                                                                    <span className={\`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider \${getStateColor(determineState(order.deliveryAddress))}\`}>
                                                                        {determineState(order.deliveryAddress)}
                                                                    </span>
                                                                )}
                                                            </div>`;

const plannerRepl = `                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-[10px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                                    {order.orderNumber}
                                                                </span>
                                                                {getExtractedDo(order) && (
                                                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="AI Extracted DO Number">
                                                                        DO: {getExtractedDo(order)}
                                                                    </span>
                                                                )}
                                                                {order.deliveryAddress && (
                                                                    <span className={\`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider \${getStateColor(determineState(order.deliveryAddress))}\`}>
                                                                        {determineState(order.deliveryAddress)}
                                                                    </span>
                                                                )}
                                                            </div>`;

// 6. DND lane card (Kanban)
const dndTarget = `                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 tracking-wide">
                                                                        {order.orderNumber}
                                                                    </div>
                                                                    {order.deliveryAddress && (
                                                                        <div className={\`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider \${getStateColor(determineState(order.deliveryAddress))}\`}>
                                                                            {determineState(order.deliveryAddress)}
                                                                        </div>
                                                                    )}`;

const dndRepl = `                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 tracking-wide">
                                                                        {order.orderNumber}
                                                                    </div>
                                                                    {getExtractedDo(order) && (
                                                                        <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="AI Extracted DO Number">
                                                                            DO: {getExtractedDo(order)}
                                                                        </div>
                                                                    )}
                                                                    {order.deliveryAddress && (
                                                                        <div className={\`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider \${getStateColor(determineState(order.deliveryAddress))}\`}>
                                                                            {determineState(order.deliveryAddress)}
                                                                        </div>
                                                                    )}`;

// 7. Table view
const tableTarget = `                                                <td className="p-4">
                                                    <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-block border border-blue-500/20 tracking-wide">
                                                        {order.orderNumber}
                                                    </div>
                                                </td>`;

const tableRepl = `                                                <td className="p-4">
                                                    <div className="font-mono text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-block border border-blue-500/20 tracking-wide">
                                                        {order.orderNumber}
                                                    </div>
                                                    {getExtractedDo(order) && (
                                                        <div className="text-[10px] font-bold text-emerald-400 mt-1" title="AI Extracted DO Number">
                                                            DO: {getExtractedDo(order)}
                                                        </div>
                                                    )}
                                                </td>`;

function replace(target, replacement, label) {
    if (!content.includes(target)) {
        console.error(`❌ Target not found for: ${label}`);
        process.exit(1);
    }
    content = content.replace(target, replacement);
    console.log(`✅ Applied: ${label}`);
}

replace(searchHaystackTarget, searchHaystackRepl, '1. Search Haystack');
replace(helperTarget, helperRepl, '2. Helper function');
replace(mappingTarget, mappingRepl, '3. fetchData mapping');
replace(unassignedTarget, unassignedRepl, '4. Unassigned Kanban cards');
replace(plannerTarget, plannerRepl, '5. Assigned planner cards');
replace(dndTarget, dndRepl, '6. DND lane cards');
replace(tableTarget, tableRepl, '7. Table view cell');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('🎉 Done editing DeliveryOrderManagement.tsx');
