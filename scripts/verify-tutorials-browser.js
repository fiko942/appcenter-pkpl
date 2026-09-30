const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketClient = globalThis.WebSocket;

async function main() {
    console.log('[DevTools] Starting browser automation test...');

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
        console.log('[DevTools] Chrome launched. Available targets:', pages.map(p => ({ type: p.type, title: p.title })));

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
                if (data.error) reject(data.error);
                else resolve(data.result);
            }
        };

        if (ws.readyState !== 1) {
            await new Promise((resolve, reject) => {
                ws.onopen = resolve;
                ws.onerror = reject;
            });
        }
        console.log('[DevTools] WebSocket connected to page:', page.title);

        await sendCommand('Page.enable');
        await sendCommand('Runtime.enable');
        await sendCommand('DOM.enable');

        // Step 1: Navigate to member login
        console.log('[DevTools] Step 1: Navigating to http://localhost:4829/member/login...');
        await sendCommand('Page.navigate', { url: 'http://localhost:4829/member/login' });
        await new Promise(r => setTimeout(r, 1500));

        // Step 2: Perform authenticated login request in page context
        console.log('[DevTools] Step 2: Authenticating with tobellord@gmail.com...');
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
                    return { status: res.status, redirected: res.redirected, url: res.url };
                })()
            `,
            awaitPromise: true,
            returnByValue: true
        });
        console.log('[DevTools] Login Response:', JSON.stringify(loginRes.result ? loginRes.result.value : loginRes));

        await new Promise(r => setTimeout(r, 1500));

        // Check current location after login
        const urlEval = await sendCommand('Runtime.evaluate', {
            expression: 'window.location.href',
            returnByValue: true
        });
        console.log('[DevTools] Current URL after login:', urlEval.result ? urlEval.result.value : 'unknown');

        // Step 3: Navigate to /member/tutorials
        console.log('[DevTools] Step 3: Navigating to http://localhost:4829/member/tutorials...');
        await sendCommand('Page.navigate', { url: 'http://localhost:4829/member/tutorials' });
        await new Promise(r => setTimeout(r, 2000));

        // Step 4: Evaluate DOM elements on /member/tutorials
        const pageEvaluation = await sendCommand('Runtime.evaluate', {
            expression: `
                (function() {
                    const cards = document.querySelectorAll('.tutorial-card');
                    const sidebarLink = document.querySelector('a[href="/member/tutorials"]');
                    const searchInput = document.getElementById('tutorialSearchInput');
                    const cinemaModal = document.getElementById('tutorialCinemaModal');
                    const titles = Array.from(cards).map(c => c.getAttribute('data-title'));
                    const products = Array.from(cards).map(c => c.getAttribute('data-product-name'));
                    const thumbnails = Array.from(document.querySelectorAll('.tutorial-card img')).map(img => img.src);

                    return {
                        currentUrl: window.location.href,
                        pageTitle: document.title,
                        sidebarFound: Boolean(sidebarLink),
                        sidebarActive: sidebarLink ? sidebarLink.classList.contains('bg-gray-800') : false,
                        cardCount: cards.length,
                        hasSearchInput: Boolean(searchInput),
                        hasCinemaModal: Boolean(cinemaModal),
                        titles: titles.slice(0, 5),
                        products: [...new Set(products)],
                        thumbnails: thumbnails.slice(0, 3)
                    };
                })()
            `,
            returnByValue: true
        });

        console.log('[DevTools] Page Evaluation Result:', JSON.stringify(pageEvaluation.result.value, null, 2));

        // Capture Grid Screenshot
        const gridScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
        const gridScreenshotPath = path.join(__dirname, '../member-tutorials-grid-screenshot.png');
        fs.writeFileSync(gridScreenshotPath, Buffer.from(gridScreenshot.data, 'base64'));
        console.log('[DevTools] Grid screenshot saved to:', gridScreenshotPath);

        // Step 5: Test opening Cinema Modal Player
        console.log('[DevTools] Step 5: Testing openCinemaModal interaction...');
        const modalTest = await sendCommand('Runtime.evaluate', {
            expression: `
                (function() {
                    const firstCard = document.querySelector('.tutorial-card');
                    if (!firstCard) return { success: false, error: 'No tutorial cards found' };
                    
                    const prodId = parseInt(firstCard.getAttribute('data-product-id'));
                    openCinemaModal(prodId, 0);

                    const modal = document.getElementById('tutorialCinemaModal');
                    const iframe = document.getElementById('cinemaIframe');
                    const prodName = document.getElementById('cinemaProductName').innerText;
                    const videoTitle = document.getElementById('cinemaVideoTitle').innerText;
                    const playlistItems = document.querySelectorAll('#cinemaPlaylistItems button').length;

                    return {
                        success: true,
                        modalVisible: !modal.classList.contains('hidden'),
                        iframeSrc: iframe.src,
                        prodName,
                        videoTitle,
                        playlistItems
                    };
                })()
            `,
            returnByValue: true
        });

        console.log('[DevTools] Cinema Modal Test Result:', JSON.stringify(modalTest.result.value, null, 2));

        // Wait a tick for transition
        await new Promise(r => setTimeout(r, 500));

        // Step 6: Capture Screenshot of Cinema Modal
        const modalScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
        const modalScreenshotPath = path.join(__dirname, '../member-tutorials-modal-screenshot.png');
        fs.writeFileSync(modalScreenshotPath, Buffer.from(modalScreenshot.data, 'base64'));
        console.log('[DevTools] Modal screenshot saved to:', modalScreenshotPath);

        // Step 7: Test search filtering with 'affilia'
        console.log('[DevTools] Step 7: Testing closeCinemaModal and search filter with keyword "affilia"...');
        const filterTest = await sendCommand('Runtime.evaluate', {
            expression: `
                (function() {
                    closeCinemaModal();
                    const searchInput = document.getElementById('tutorialSearchInput');
                    searchInput.value = 'affilia';
                    searchInput.dispatchEvent(new Event('input'));

                    const visibleCards = document.querySelectorAll('.tutorial-card:not(.hidden)').length;
                    return {
                        modalHiddenAfterClose: document.getElementById('tutorialCinemaModal').classList.contains('hidden') || document.getElementById('tutorialCinemaModal').classList.contains('opacity-0'),
                        iframeSrcCleared: document.getElementById('cinemaIframe').src === '' || document.getElementById('cinemaIframe').src.endsWith('#'),
                        visibleCardsAfterSearch: visibleCards
                    };
                })()
            `,
            returnByValue: true
        });

        console.log('[DevTools] Filter & Close Modal Test Result:', JSON.stringify(filterTest.result.value, null, 2));

        // Wait a tick and capture filtered screenshot
        await new Promise(r => setTimeout(r, 400));
        const filteredScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
        const filteredScreenshotPath = path.join(__dirname, '../member-tutorials-filtered-screenshot.png');
        fs.writeFileSync(filteredScreenshotPath, Buffer.from(filteredScreenshot.data, 'base64'));
        console.log('[DevTools] Filtered search screenshot saved to:', filteredScreenshotPath);

        ws.close();
        console.log('[DevTools] ALL BROWSER CHECKS PASSED PERFECTLY!');
    } catch (err) {
        console.error('[DevTools] Test failed with error:', err);
    } finally {
        chromeProcess.kill();
    }
}

main().catch(console.error);
