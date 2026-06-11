async function run() {
    const ip = '2406:da1a:6b0:f614:3f5:dda0:bef1:314b';
    const url = `http://ip-api.com/json/${ip}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("IP Info:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
