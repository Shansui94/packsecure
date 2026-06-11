import 'dotenv/config';
import handler from '../api/agent/chat';

async function runTest() {
    const query = '这个月有多少个trip去吉兰丹';
    console.log(`Executing Driver chat test...`);
    console.log(`Query: "${query}"`);
    
    await new Promise<void>((resolve) => {
        const mockReq = {
            method: 'POST',
            body: {
                query: query,
                userContext: {
                    role: 'Driver',
                    name: 'DRIVER TEST',
                    email: 'driver@packsecure.local',
                    uid: 'some-driver-uid',
                    employeeId: '009'
                }
            }
        };
        
        const mockRes = {
            status(code: number) {
                console.log(`   [Status] ${code}`);
                return this;
            },
            json(data: any) {
                console.log('   [JSON Response]');
                console.log(data.response || JSON.stringify(data, null, 2));
                resolve();
                return this;
            }
        };
        
        handler(mockReq as any, mockRes as any).catch(err => {
            console.error("   [Error Exception]", err);
            resolve();
        });
    });
}

runTest();
