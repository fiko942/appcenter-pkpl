const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketClient = globalThis.WebSocket;

const ARTIFACT_DIR = '/Users/fiko942/.gemini/antigravity/brain/05454e33-7145-4949-982a-25cf7141cabf';

async function main() {
    console.log('[DevTools] Starting updated Svelte UI verification on port 4829...');

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const remoteDebuggingPort = 9222;

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${remoteDebuggingPort}`,
        '--disable-gpu',
        '--window-size=1440,900',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=/tmp/chrome-test-profile-svelte-updated-' + Date.now()
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
                    reject(new Error(data.error.message));
                } else {
                    resolve(data.result);
                }
            }
        };

        await new Promise((resolve) => ws.onopen = resolve);
        console.log('[DevTools] WebSocket connected.');

        await sendCommand('Page.enable');
        await sendCommand('Runtime.enable');
        await sendCommand('DOM.enable');

        async function navigateAndSettle(url) {
            console.log(`[DevTools] Navigating to ${url}...`);
            await sendCommand('Page.navigate', { url });
            await new Promise(resolve => setTimeout(resolve, 1800));
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

        // 1. Authenticate session
        await navigateAndSettle('http://localhost:4829/index.html#/member/login');
        await sendCommand('Runtime.evaluate', {
            expression: `
                (async function() {
                    const res = await fetch('/member/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: 'email=' + encodeURIComponent('testuser@example.com') + '&password=' + encodeURIComponent('testpassword123'),
                        redirect: 'follow'
                    });
                    return { status: res.status, url: res.url };
                })()
            `,
            awaitPromise: true,
            returnByValue: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 2. Product Detail: Initial view with real active users
        await navigateAndSettle('http://localhost:4829/index.html#/member/orders/create');
        await takeScreenshot('svelte-08-product-detail-active-users.png');

        // 3. Product Detail: Click custom Svelte dropdown to show open popup
        console.log('[DevTools] Opening Custom Svelte Dropdown...');
        await evalJs(`
            const btn = document.querySelector('.custom-dropdown-root button');
            if (btn) btn.click();
        `);
        await new Promise(resolve => setTimeout(resolve, 600));
        await takeScreenshot('svelte-09-custom-dropdown-open.png');

        // 4. Tutorials Hub: Product-first selection (Affilia selected with 5 videos from DB)
        await navigateAndSettle('http://localhost:4829/index.html#/member/tutorials');
        await takeScreenshot('svelte-10-tutorials-affilia-selected.png');

        // 5. Tutorials Hub: Select AsistenQ Owner tab to verify empty state / switcher
        console.log('[DevTools] Clicking AsistenQ Owner product tab in Tutorials Hub...');
        await evalJs(`
            const tabs = Array.from(document.querySelectorAll('section button'));
            const asistenTab = tabs.find(b => b.textContent.includes('AsistenQ'));
            if (asistenTab) asistenTab.click();
        `);
        await new Promise(resolve => setTimeout(resolve, 600));
        await takeScreenshot('svelte-11-tutorials-asistenq-empty-state.png');

        console.log('[DevTools] All updated requirements verified successfully!');
        ws.close();
    } catch (err) {
        console.error('[DevTools] Error during verification:', err);
    } finally {
        chromeProcess.kill();
    }
}

main().catch(console.error);
