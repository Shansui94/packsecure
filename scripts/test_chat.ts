import 'dotenv/config';
import handler from '../api/agent/chat';

const queries = [
    {
        name: 'Test 1: Schema Query',
        query: '🔍 查主表 Schema'
    },
    {
        name: 'Test 2: Analytical Logistical Query (Kelantan Trips last month)',
        query: '上个月有多少个trip去吉兰丹？'
    },
    {
        name: 'Test 3: Pending Leaves Query',
        query: '帮我查一下现在有哪些待审核的请假申请？'
    },
    {
        name: 'Test 4: General Trips Count Query (Without zone filter)',
        query: '上个月一共有多少个trip？'
    }
];

function createMockRes(resolve: () => void) {
    return {
        status(code: number) {
            console.log(`   [Status] ${code}`);
            return this;
        },
        json(data: any) {
            console.log('   [JSON Response]');
            console.log(data.response || JSON.stringify(data, null, 2));
            console.log('-----------------------------------------------------\n');
            resolve();
            return this;
        }
    };
}

async function runTests() {
    console.log("=== STARTING BACKEND FUNCTION CALLING DIAGNOSTIC ===\n");
    for (const testCase of queries) {
        console.log(`Executing ${testCase.name}...`);
        console.log(`Query: "${testCase.query}"`);
        
        await new Promise<void>((resolve) => {
            const mockReq = {
                method: 'POST',
                body: {
                    query: testCase.query,
                    userContext: {
                        role: 'SuperAdmin',
                        name: 'Max Tan',
                        email: 'admin@packsecure.local',
                        uid: 'some-uid',
                        employeeId: '001'
                    }
                }
            };
            
            const mockRes = createMockRes(resolve);
            handler(mockReq as any, mockRes as any).catch(err => {
                console.error("   [Error Exception]", err);
                resolve();
            });
        });
    }
    console.log("=== DIAGNOSTIC COMPLETE ===");
}

runTests();
