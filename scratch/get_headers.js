async function run() {
    const url = 'https://kdahubyhwndgyloaljak.supabase.co/rest/v1/';
    try {
        const res = await fetch(url);
        console.log("Status:", res.status);
        console.log("Headers:");
        for (const [key, val] of res.headers.entries()) {
            console.log(`- ${key}: ${val}`);
        }
    } catch (e) {
        console.error(e);
    }
}
run();
