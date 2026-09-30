const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketClient = globalThis.WebSocket;

const ARTIFACT_DIR = '/Users/fiko942/.gemini/antigravity/brain/05454e33-7145-4949-982a-25cf7141cabf';

async function main() {
    console.log('[DevTools] Starting full UI verification for Appcenter Ziqva...');

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const remoteDebuggingPort = 9222;

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${remoteDebuggingPort}`,
        '--disable-gpu',
        '--window-size=1440,900',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=/tmp/chrome-test-profile-' + Date.now()
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
        console.log('[DevTools] Available targets:', pages.map(p => ({ type: p.type, title: p.title })));

        const page = pages.find(p => p.type === 'page') || pages[0];
        const wsUrl = page.webSocketDebuggerUrl;
        const ws = new WebSocketClient(wsUrl);

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
                    reject(new Error(data.error.message));
                } else {
                    resolve(data.result);
                }
            }
        };

        await new Promise((resolve) => ws.onopen = resolve);
        console.log('[DevTools] WebSocket connected to Chrome target.');

        await sendCommand('Page.enable');
        await sendCommand('Runtime.enable');
        await sendCommand('DOM.enable');

        async function navigateAndSettle(url) {
            console.log(`[DevTools] Navigating to ${url}...`);
            await sendCommand('Page.navigate', { url });
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        async function evalJs(expression) {
            const res = await sendCommand('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            return res.result ? res.result.value : null;
        }

        async function takeScreenshot(fileName) {
            const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
            const buffer = Buffer.from(res.data, 'base64');
            const filePath = path.join(ARTIFACT_DIR, fileName);
            fs.writeFileSync(filePath, buffer);
            console.log(`[DevTools] Screenshot saved: ${filePath}`);
            return filePath;
        }

        // 1. Visit Login Page
        await navigateAndSettle('http://localhost:4829/member/login');
        await takeScreenshot('ui-verify-01-login-dark.png');

        // 2. Perform Login via Fetch in page context
        console.log('[DevTools] Performing authenticated login...');
        const loginRes = await sendCommand('Runtime.evaluate', {
            expression: `
                (async function() {
                    const res = await fetch('/member/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: 'email=' + encodeURIComponent('testuser@example.com') + '&password=' + encodeURIComponent('testpassword123'),
                        redirect: 'follow'
                    });
                    return { status: res.status, url: res.url };
                })()
            `,
            awaitPromise: true,
            returnByValue: true
        });
        console.log('[DevTools] Login result:', loginRes.result ? loginRes.result.value : loginRes);
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Member Dashboard (Dark Mode)
        await navigateAndSettle('http://localhost:4829/member/dashboard');
        await evalJs(`document.documentElement.setAttribute('data-theme', 'dark');`);
        await new Promise(resolve => setTimeout(resolve, 500));
        await takeScreenshot('ui-verify-02-dashboard-dark.png');

        // 4. Member Dashboard (Light Mode)
        console.log('[DevTools] Switching dashboard to light theme...');
        await evalJs(`
            window.toggleTheme();
        `);
        await new Promise(resolve => setTimeout(resolve, 500));
        await takeScreenshot('ui-verify-03-dashboard-light.png');

        // Switch back to dark for consistency
        await evalJs(`window.toggleTheme();`);
        await new Promise(resolve => setTimeout(resolve, 500));

        // 5. Member Tutorials Hub
        await navigateAndSettle('http://localhost:4829/member/tutorials');
        await takeScreenshot('ui-verify-04-tutorials-dark.png');

        // 6. Member Order / Product Detail View
        await navigateAndSettle('http://localhost:4829/member/orders/create');
        await takeScreenshot('ui-verify-05-order-product-detail.png');

        // 7. Member Downloads Hub
        await navigateAndSettle('http://localhost:4829/member/downloads');
        await takeScreenshot('ui-verify-06-downloads-hub.png');

        // 8. Member Licenses Management
        await navigateAndSettle('http://localhost:4829/member/licenses');
        await takeScreenshot('ui-verify-07-licenses-hub.png');

        console.log('[DevTools] All screenshots and UI verifications successfully completed!');
        ws.close();
    } catch (err) {
        console.error('[DevTools] Automation Error:', err);
    } finally {
        chromeProcess.kill();
    }
}

main().catch(console.error);
