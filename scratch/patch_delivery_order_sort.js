import fs from 'fs';

const filePath = 'src/pages/DeliveryOrderManagement.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 第一处匹配和替换
const firstTarget = `                                const driverOrders = filteredOrders
                                    .filter(o => o.driverId === driver.uid)
                                    .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0));`;

const firstReplacement = `                                const driverOrders = filteredOrders
                                    .filter(o => o.driverId === driver.uid)
                                    .sort((a, b) => {
                                        const dateA = a.deadline || '';
                                        const dateB = b.deadline || '';
                                        if (dateA !== dateB) {
                                            return dateA.localeCompare(dateB);
                                        }
                                        return (a.tripSequence || 0) - (b.tripSequence || 0);
                                    });`;

// 第二处匹配和替换
const secondTarget = `                        const driverOrders = filteredOrders
                            .filter(o => {
                                if (driver.uid === 'unassigned') {
                                    return !o.driverId && (o.trip_origin || 'TAIPING').toUpperCase() === activeLocation.toUpperCase();
                                }
                                return o.driverId === driver.uid;
                            })
                            .sort((a, b) => (a.tripSequence || 0) - (b.tripSequence || 0)); // Ensure visual order matches logical order for DnD`;

const secondReplacement = `                        const driverOrders = filteredOrders
                            .filter(o => {
                                if (driver.uid === 'unassigned') {
                                    return !o.driverId && (o.trip_origin || 'TAIPING').toUpperCase() === activeLocation.toUpperCase();
                                }
                                return o.driverId === driver.uid;
                            })
                            .sort((a, b) => {
                                const dateA = a.deadline || '';
                                const dateB = b.deadline || '';
                                if (dateA !== dateB) {
                                    return dateA.localeCompare(dateB);
                                }
                                return (a.tripSequence || 0) - (b.tripSequence || 0);
                            }); // Ensure visual order matches logical order for DnD`;

content = content.replace(/\r\n/g, '\n');
const firstTargetNorm = firstTarget.replace(/\r\n/g, '\n');
const firstReplacementNorm = firstReplacement.replace(/\r\n/g, '\n');
const secondTargetNorm = secondTarget.replace(/\r\n/g, '\n');
const secondReplacementNorm = secondReplacement.replace(/\r\n/g, '\n');

let replaced = false;

if (content.includes(firstTargetNorm)) {
    content = content.replace(firstTargetNorm, firstReplacementNorm);
    console.log("First sort replacement applied!");
    replaced = true;
} else {
    console.error("First sort target not found.");
}

if (content.includes(secondTargetNorm)) {
    content = content.replace(secondTargetNorm, secondReplacementNorm);
    console.log("Second sort replacement applied!");
    replaced = true;
} else {
    console.error("Second sort target not found.");
}

if (replaced) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("All sort replacements written back to file successfully!");
}
