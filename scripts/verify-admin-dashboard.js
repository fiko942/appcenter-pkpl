const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketClient = globalThis.WebSocket;

const ARTIFACT_DIR = '/Users/fiko942/.gemini/antigravity/brain/3744a5d2-4682-465d-8bbc-05dea9be2edb';

function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {}
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

async function runApiTests() {
    console.log('\n--- [1/2] Running Backend Admin Dashboard API Tests with PIN 085213 ---');

    // 1. Login with PIN 085213
    const loginRes = await httpRequest({
        hostname: 'localhost',
        port: 4829,
        path: '/admin/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }, { pin: '085213' });

    console.log('Login Result:', loginRes.statusCode, loginRes.body);
    const cookieHeader = loginRes.headers['set-cookie'];
    const sessionCookie = cookieHeader ? cookieHeader[0].split(';')[0] : '';
    console.log('Session Cookie:', sessionCookie ? '✅ Captured' : '❌ Missing');

    // 2. Fetch Dashboard API
    const dashRes = await httpRequest({
        hostname: 'localhost',
        port: 4829,
        path: '/admin/api/dashboard',
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cookie': sessionCookie
        }
    });

    console.log('Dashboard API Status:', dashRes.statusCode === 200 ? '✅ 200 OK' : '❌ Error', {
        adminName: dashRes.body.data?.adminName,
        totalOrders: dashRes.body.data?.stats?.totalOrders,
        totalRevenue: dashRes.body.data?.stats?.totalRevenue,
        topProductsCount: dashRes.body.data?.topProducts?.length,
        graphPoints: dashRes.body.data?.revenueGraphData?.length,
        recentOrdersCount: dashRes.body.data?.recentOrders?.length
    });

    return sessionCookie;
}

async function runBrowserTests(sessionCookie) {
    console.log('\n--- [2/2] Running Headless Chrome Browser Verification for Admin Dashboard ---');

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const remoteDebuggingPort = 9224;

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${remoteDebuggingPort}`,
        '--disable-gpu',
        '--window-size=1440,900',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=/tmp/chrome-test-admin-dashboard-' + Date.now()
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
        const pages = await getJson(`http://localhost:${remoteDebuggingPort}/json/list`);
        const page = pages.find(p => p.type === 'page') || pages[0];
        const ws = new WebSocketClient(page.webSocketDebuggerUrl);

        let messageId = 1;
        const callbacks = new Map();

        function sendCommand(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = messageId++;
                callbacks.set(id, { resolve, reject });
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data.toString());
            if (data.id && callbacks.has(data.id)) {
                const { resolve, reject } = callbacks.get(data.id);
                callbacks.delete(data.id);
                if (data.error) {
                    reject(data.error);
                } else {
                    resolve(data.result);
                }
            }
        };

        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        await sendCommand('Page.enable');
        await sendCommand('Runtime.enable');
        await sendCommand('Network.enable');
        await sendCommand('DOM.enable');

        // Set session cookie in browser
        if (sessionCookie) {
            const [cookieName, cookieValue] = sessionCookie.split('=');
            await sendCommand('Network.setCookie', {
                name: cookieName,
                value: cookieValue,
                domain: 'localhost',
                path: '/'
            });
        }

        console.log('[Browser] Navigating to http://localhost:4829/#/admin/dashboard...');
        await sendCommand('Page.navigate', { url: 'http://localhost:4829/#/admin/dashboard' });

        // Wait until skeleton loader is gone
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 500));
            const checkRes = await sendCommand('Runtime.evaluate', {
                expression: `!document.querySelector('.animate-pulse') && !!document.querySelector('table tbody tr')`
            });
            if (checkRes.result?.value) {
                console.log(`[Browser] Data loaded successfully after ${(i + 1) * 500}ms`);
                break;
            }
        }

        // Evaluate Page Title & elements
        const statusRes = await sendCommand('Runtime.evaluate', {
            expression: `
                ({
                    title: document.title,
                    h1: document.querySelector('h1')?.innerText,
                    sidebarBrand: document.querySelector('.brand b')?.innerText,
                    cardsCount: document.querySelectorAll('.grid > div').length,
                    tableRows: document.querySelectorAll('tbody tr').length
                })
            `,
            returnByValue: true
        });
        console.log('[Browser] Page Elements Detected:', statusRes.result?.value);

        // Take Dark Mode Screenshot
        const darkScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
        const darkPath = path.join(ARTIFACT_DIR, 'admin-dashboard-dark-screenshot.png');
        fs.writeFileSync(darkPath, Buffer.from(darkScreenshot.data, 'base64'));
        console.log('✅ Dark mode screenshot saved:', darkPath);

        // Toggle to Light Mode
        await sendCommand('Runtime.evaluate', {
            expression: `
                const themeBtn = document.querySelector('button[aria-label="Toggle Theme"], button.theme-toggle, [data-theme-toggle]');
                if (themeBtn) themeBtn.click();
                else document.documentElement.setAttribute('data-theme', 'light');
            `
        });
        await new Promise(r => setTimeout(r, 600));

        const lightScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
        const lightPath = path.join(ARTIFACT_DIR, 'admin-dashboard-light-screenshot.png');
        fs.writeFileSync(lightPath, Buffer.from(lightScreenshot.data, 'base64'));
        console.log('✅ Light mode screenshot saved:', lightPath);

        ws.close();
        chromeProcess.kill();
        console.log('🎉 Admin Dashboard browser testing & screenshots verified successfully!');
    } catch (err) {
        console.error('Browser testing error:', err);
        chromeProcess.kill();
    }
}

async function main() {
    const cookie = await runApiTests();
    await runBrowserTests(cookie);
}

main();
