const { spawn } = require('child_process');
const http = require('http');
const WebSocketClient = globalThis.WebSocket;

function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try { parsed = JSON.parse(data); } catch (e) {}
                resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function loginAdmin() {
    console.log('--- Logging in Admin with PIN 085213 ---');
    const res = await httpRequest({
        hostname: 'localhost',
        port: 4829,
        path: '/admin/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }, { pin: '085213' });

    const cookieHeader = res.headers['set-cookie'];
    const sessionCookie = cookieHeader ? cookieHeader[0].split(';')[0] : '';
    console.log('Login Status:', res.statusCode, 'Session Cookie:', sessionCookie ? '✅ Captured' : '❌ Failed');
    return sessionCookie;
}

async function testSpaNavigation(sessionCookie) {
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const remoteDebuggingPort = 9226;

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${remoteDebuggingPort}`,
        '--disable-gpu',
        '--window-size=1440,900',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=/tmp/chrome-test-spa-' + Date.now()
    ], { stdio: 'ignore' });

    await new Promise(resolve => setTimeout(resolve, 1500));

    function getJson(url) {
        return new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
    }

    try {
        const tabs = await getJson(`http://localhost:${remoteDebuggingPort}/json`);
        const tab = tabs.find(t => t.type === 'page') || tabs[0];
        const ws = new WebSocketClient(tab.webSocketDebuggerUrl);

        let idCounter = 1;
        const pendingCallbacks = new Map();

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                cb(data);
            }
        };

        await new Promise(resolve => ws.onopen = resolve);

        function sendCommand(method, params = {}) {
            return new Promise((resolve) => {
                const id = idCounter++;
                pendingCallbacks.set(id, (data) => resolve(data.result || data));
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await sendCommand('Network.enable');
        await sendCommand('Page.enable');
        await sendCommand('Runtime.enable');

        if (sessionCookie) {
            const [cookieName, cookieValue] = sessionCookie.split('=');
            await sendCommand('Network.setCookie', {
                name: cookieName.trim(),
                value: cookieValue.trim(),
                domain: 'localhost',
                path: '/'
            });
        }

        console.log('\n--- 1. Navigating to Initial Page: http://localhost:4829/#/admin/dashboard ---');
        await sendCommand('Page.navigate', { url: 'http://localhost:4829/#/admin/dashboard' });
        await new Promise(r => setTimeout(r, 2000));

        const pageInfo = await sendCommand('Runtime.evaluate', {
            expression: `({
                url: window.location.href,
                hash: window.location.hash,
                title: document.title,
                body: document.body.innerText.substring(0, 200)
            })`,
            returnByValue: true
        });
        console.log('Current Page Info:', pageInfo.result?.value);

        // Set SPA Memory marker
        await sendCommand('Runtime.evaluate', {
            expression: 'window.__SPA_PERSISTENT_MEMORY_TEST__ = "NO_RELOAD_SUCCESS_VALUE";'
        });

        const testLinks = [
            { href: '#/admin/payments', expectedHeading: 'Daftar Pembayaran' },
            { href: '#/admin/trials/create', expectedHeading: 'Buat Kode Trial' },
            { href: '#/admin/products', expectedHeading: 'Katalog Produk' },
            { href: '#/admin/affiliate', expectedHeading: 'Affiliate Management' },
            { href: '#/admin/dashboard', expectedHeading: 'Admin Dashboard' }
        ];

        console.log('\n--- 2. Verifying Seamless SPA Hash Navigation (No Hard Page Reload) ---');

        for (const target of testLinks) {
            // Click the link inside the DOM
            const clickRes = await sendCommand('Runtime.evaluate', {
                expression: `(() => {
                    const link = document.querySelector('a[href="${target.href}"]');
                    if (link) {
                        link.click();
                        return { clicked: true, text: link.innerText.trim() };
                    }
                    const allLinks = Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href'));
                    return { clicked: false, allLinks };
                })()`,
                returnByValue: true
            });

            await new Promise(r => setTimeout(r, 600));

            // Check URL, heading, and that persistent JS memory is untouched
            const stateRes = await sendCommand('Runtime.evaluate', {
                expression: `(() => {
                    const memory = window.__SPA_PERSISTENT_MEMORY_TEST__;
                    const hash = window.location.hash;
                    const heading = document.querySelector('h1')?.innerText?.trim() || '';
                    return { memory, hash, heading };
                })()`,
                returnByValue: true
            });

            const val = stateRes.result?.value;
            const clickVal = clickRes.result?.value;
            const isNoReload = val?.memory === 'NO_RELOAD_SUCCESS_VALUE';
            const hashMatches = val?.hash === target.href;

            console.log(`▶ Navigated to [${target.href}]`);
            console.log(`   - Link Clicked: ${clickVal?.clicked ? '✅' : '❌'}`);
            if (!clickVal?.clicked) console.log('   - Available Links on Page:', clickVal?.allLinks);
            console.log(`   - URL Hash: "${val?.hash}" (Expected: "${target.href}") -> ${hashMatches ? '✅' : '❌'}`);
            console.log(`   - Page Heading: "${val?.heading}" -> ${val?.heading.includes(target.expectedHeading) ? '✅' : '❌'}`);
            console.log(`   - Zero Page Reload (Memory Preserved): ${isNoReload ? '✅ PASS' : '❌ RELOAD DETECTED'}`);

            if (!isNoReload || !hashMatches) {
                throw new Error(`SPA navigation test failed for ${target.href}`);
            }
        }

        console.log('\n======================================================');
        console.log('🎉 ALL SPA LINKS NAVIGATE INSTANTLY WITHOUT HARD RELOAD!');
        console.log('======================================================\n');

        ws.close();
    } finally {
        chromeProcess.kill();
    }
}

async function run() {
    const sessionCookie = await loginAdmin();
    await testSpaNavigation(sessionCookie);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
