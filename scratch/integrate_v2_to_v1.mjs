import fs from 'fs';
import path from 'path';

const baseDir = 'src/pages';

// 1. Process DeliveryOrderManagement
const domV2Path = path.join(baseDir, 'DeliveryOrderManagementV2.tsx');
const domV1Path = path.join(baseDir, 'DeliveryOrderManagement.tsx');

if (fs.existsSync(domV2Path)) {
    let content = fs.readFileSync(domV2Path, 'utf-8');
    // Replace component name
    content = content.replace(/const DeliveryOrderManagementV2/g, 'const DeliveryOrderManagement');
    content = content.replace(/export default DeliveryOrderManagementV2;/g, 'export default DeliveryOrderManagement;');
    
    fs.writeFileSync(domV1Path, content, 'utf-8');
    fs.unlinkSync(domV2Path);
    console.log("Successfully integrated DeliveryOrderManagementV2 into DeliveryOrderManagement and deleted V2 file.");
}

// 2. Process DriverDelivery
const driverV2Path = path.join(baseDir, 'DriverDeliveryV2.tsx');
const driverV1Path = path.join(baseDir, 'DriverDelivery.tsx');

if (fs.existsSync(driverV2Path)) {
    let content = fs.readFileSync(driverV2Path, 'utf-8');
    // Replace component name
    content = content.replace(/const DriverDeliveryV2/g, 'const DriverDelivery');
    content = content.replace(/export default DriverDeliveryV2;/g, 'export default DriverDelivery;');
    
    fs.writeFileSync(driverV1Path, content, 'utf-8');
    fs.unlinkSync(driverV2Path);
    console.log("Successfully integrated DriverDeliveryV2 into DriverDelivery and deleted V2 file.");
}
