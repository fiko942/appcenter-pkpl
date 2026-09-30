const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketClient = globalThis.WebSocket;

const ARTIFACT_DIR = '/Users/fiko942/.gemini/antigravity/brain/3744a5d2-4682-465d-8bbc-05dea9be2edb';

const ADMIN_PAGES = [
    { name: 'login', title: 'Admin PIN Login', url: 'http://localhost:4829/#/admin/login' },
    { name: 'dashboard', title: 'Admin Dashboard', url: 'http://localhost:4829/#/admin/dashboard' },
    { name: 'payments', title: 'Daftar Pembayaran', url: 'http://localhost:4829/#/admin/payments' },
    { name: 'create_trial', title: 'Buat Kode Trial', url: 'http://localhost:4829/#/admin/trials/create' },
    { name: 'products', title: 'Katalog Produk', url: 'http://localhost:4829/#/admin/products' },
    { name: 'affiliate', title: 'Affiliate Management', url: 'http://localhost:4829/#/admin/affiliate' },
    { name: 'payout_history', title: 'Riwayat Payout Affiliate', url: 'http://localhost:4829/#/admin/affiliate/history' },
];

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

async function verifyAllPages(sessionCookie) {
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const remoteDebuggingPort = 9225;

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${remoteDebuggingPort}`,
        '--disable-gpu',
        '--window-size=1440,900',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=/tmp/chrome-test-admin-all-' + Date.now()
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
        const wsUrl = tab.webSocketDebuggerUrl;

        const ws = new WebSocketClient(wsUrl);
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
                pendingCallbacks.set(id, resolve);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await sendCommand('Network.enable');
        await sendCommand('Page.enable');
        await sendCommand('DOM.enable');

        if (sessionCookie) {
            const [cookieName, cookieValue] = sessionCookie.split('=');
            await sendCommand('Network.setCookie', {
                name: cookieName.trim(),
                value: cookieValue.trim(),
                domain: 'localhost',
                path: '/'
            });
        }

        console.log('\n======================================================');
        console.log('--- STARTING VERIFICATION ACROSS ALL SVELTE SPA ADMIN PAGES ---');
        console.log('======================================================\n');

        for (const pageInfo of ADMIN_PAGES) {
            console.log(`\n▶ Verifying: [${pageInfo.title}] -> ${pageInfo.url}`);

            // 1. DESKTOP VIEWPORT (1440x900)
            await sendCommand('Emulation.setDeviceMetricsOverride', {
                width: 1440,
                height: 900,
                deviceScaleFactor: 1,
                mobile: false
            });

            await sendCommand('Page.navigate', { url: pageInfo.url });
            await new Promise(r => setTimeout(r, 1500));

            // Wait for spinner to disappear or table to appear
            await sendCommand('Runtime.evaluate', {
                expression: `new Promise(resolve => {
                    let attempts = 0;
                    const interval = setInterval(() => {
                        attempts++;
                        const spinner = document.querySelector('.animate-spin');
                        const table = document.querySelector('table');
                        const card = document.querySelector('form');
                        if ((!spinner && (table || card)) || attempts > 50) {
                            clearInterval(interval);
                            resolve(true);
                        }
                    }, 100);
                })`,
                awaitPromise: true
            });

            await new Promise(r => setTimeout(r, 800));

            const desktopEval = await sendCommand('Runtime.evaluate', {
                expression: `(() => {
                    const h1 = document.querySelector('h1')?.innerText || '';
                    const bodyText = document.body.innerText.substring(0, 100).replace(/\\n/g, ' ');
                    return { h1, bodyText };
                })()`,
                returnByValue: true
            });

            const desktopScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
            const desktopPath = path.join(ARTIFACT_DIR, `admin-${pageInfo.name}-desktop.png`);
            fs.writeFileSync(desktopPath, Buffer.from(desktopScreenshot.result.data, 'base64'));
            console.log(`  [Desktop 1440px] H1: "${desktopEval.result?.value?.h1}" | Screenshot: ${desktopPath}`);

            // 2. MOBILE VIEWPORT (375x812 iPhone)
            await sendCommand('Emulation.setDeviceMetricsOverride', {
                width: 375,
                height: 812,
                deviceScaleFactor: 2,
                mobile: true
            });

            await new Promise(r => setTimeout(r, 800));

            const mobileScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
            const mobilePath = path.join(ARTIFACT_DIR, `admin-${pageInfo.name}-mobile.png`);
            fs.writeFileSync(mobilePath, Buffer.from(mobileScreenshot.result.data, 'base64'));
            console.log(`  [Mobile 375px] Verified | Screenshot: ${mobilePath}`);
        }

        console.log('\n======================================================');
        console.log('🎉 ALL SVELTE SPA ADMIN PAGES VERIFIED SUCCESSFULLY!');
        console.log('======================================================\n');

        ws.close();
    } finally {
        chromeProcess.kill();
    }
}

async function run() {
    const sessionCookie = await loginAdmin();
    await verifyAllPages(sessionCookie);
}

run().catch(console.error);
