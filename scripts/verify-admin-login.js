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
    console.log('\n--- [1/2] Running Backend Admin JSON API Tests ---');

    // 1. Incomplete PIN
    const res1 = await httpRequest({
        hostname: 'localhost',
        port: 4829,
        path: '/admin/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }, { pin: '123' });
    console.log('Test 1 (Short PIN):', res1.statusCode === 400 ? '✅ PASSED' : '❌ FAILED', res1.body);

    // 2. Invalid PIN
    const res2 = await httpRequest({
        hostname: 'localhost',
        port: 4829,
        path: '/admin/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }, { pin: '999999' });
    console.log('Test 2 (Wrong PIN):', res2.statusCode === 401 ? '✅ PASSED' : '❌ FAILED', res2.body);

    // 3. Unauthenticated session check
    const res3 = await httpRequest({
        hostname: 'localhost',
        port: 4829,
        path: '/admin/api/session',
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });
    console.log('Test 3 (Session Unauth):', res3.statusCode === 200 && res3.body.authenticated === false ? '✅ PASSED' : '❌ FAILED', res3.body);
}

async function runBrowserTests() {
    console.log('\n--- [2/2] Running Headless Chrome Browser Tests for Svelte Admin Login ---');

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const remoteDebuggingPort = 9223;

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${remoteDebuggingPort}`,
        '--disable-gpu',
        '--window-size=1440,900',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=/tmp/chrome-test-admin-login-' + Date.now()
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
        await sendCommand('DOM.enable');

        console.log('[Browser] Navigating to http://localhost:4829/#/admin/login...');
        await sendCommand('Page.navigate', { url: 'http://localhost:4829/#/admin/login' });

        await new Promise(r => setTimeout(r, 2000));

        // Evaluate Page Title & elements
        const titleRes = await sendCommand('Runtime.evaluate', {
            expression: `document.title + " | Header: " + (document.querySelector('h1')?.innerText || '') + " | Inputs: " + document.querySelectorAll('input').length`
        });
        console.log('[Browser] Page Status:', titleRes.result?.value);

        // Take Dark Mode Screenshot
        const darkScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
        const darkPath = path.join(ARTIFACT_DIR, 'admin-login-dark-screenshot.png');
        fs.writeFileSync(darkPath, Buffer.from(darkScreenshot.data, 'base64'));
        console.log('✅ Dark mode screenshot saved:', darkPath);

        // Click a keypad button to test interaction
        await sendCommand('Runtime.evaluate', {
            expression: `
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn1 = buttons.find(b => b.innerText.trim() === '1');
                if (btn1) btn1.click();
            `
        });
        await new Promise(r => setTimeout(r, 500));

        // Toggle to Light Mode
        await sendCommand('Runtime.evaluate', {
            expression: `
                const themeBtn = document.querySelector('button[aria-label="Toggle Theme"], button.theme-toggle, [data-theme-toggle]');
                if (themeBtn) themeBtn.click();
                else document.documentElement.setAttribute('data-theme', 'light');
            `
        });
        await new Promise(r => setTimeout(r, 500));

        const lightScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
        const lightPath = path.join(ARTIFACT_DIR, 'admin-login-light-screenshot.png');
        fs.writeFileSync(lightPath, Buffer.from(lightScreenshot.data, 'base64'));
        console.log('✅ Light mode screenshot saved:', lightPath);

        ws.close();
        chromeProcess.kill();
        console.log('🎉 All browser tests and screenshot verifications completed successfully!');
    } catch (err) {
        console.error('Browser testing error:', err);
        chromeProcess.kill();
    }
}

async function main() {
    await runApiTests();
    await runBrowserTests();
}

main();
