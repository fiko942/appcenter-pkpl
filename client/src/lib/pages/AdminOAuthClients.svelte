<script lang="ts">
    import { onMount } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';

    interface OAuthClient {
        id: number;
        client_id: string;
        has_secret: boolean;
        name: string;
        description: string | null;
        icon_url: string | null;
        allowed_redirect_uris: string[];
        allowed_origins: string[];
        allowed_scopes: string;
        is_trusted: boolean;
        is_active: boolean;
        active_tokens_count: number;
        created_by: string | null;
        created_at: string;
        updated_at: string;
    }

    let loading: boolean = true;
    let clients: OAuthClient[] = [];
    let error: string = '';
    let successMessage: string = '';

    // Navigation Tabs
    type TabKey = 'apps' | 'ai-prompt' | 'docs' | 'snippets' | 'pkce-tool' | 'errors';
    let activeTab: TabKey = 'apps';

    // Search & Filter (Apps Tab)
    let searchQuery: string = '';
    let filterStatus: 'all' | 'active' | 'inactive' | 'trusted' = 'all';

    // Code Snippets Language Tab
    type SnippetLang = 'nodejs' | 'python' | 'php' | 'flutter' | 'react' | 'curl';
    let activeLang: SnippetLang = 'nodejs';

    // Vibe Coder AI Prompt Generator State
    type VibeArchPreset = 'master-plan' | 'nextjs-fullstack' | 'node-express' | 'python-fastapi' | 'flutter-pkce' | 'react-spa' | 'php-laravel' | 'golang';
    let vibeArchPreset: VibeArchPreset = 'master-plan';
    let promptTargetClientId: string = '';
    let promptTargetSecret: string = 'YOUR_CLIENT_SECRET';
    let promptRedirectUri: string = 'http://localhost:3000/callback';
    let promptScope: string = 'profile email';
    let promptRequirePkce: boolean = false;
    let promptIncludeTests: boolean = true;
    let promptIncludeTypes: boolean = true;
    let knownSecrets: Record<string, string> = {};
    let showSecretInSelector: boolean = false;

    // PKCE Generator Live State
    let liveVerifier: string = '';
    let liveChallenge: string = '';
    let pkceClientId: string = '';
    let pkceRedirectUri: string = 'http://localhost:3000/callback';
    let pkceState: string = 'random_csrf_token_123';
    let pkceScope: string = 'profile email';

    // Live Token Exchange Test Simulator State
    let simCode: string = '';
    let simLoading: boolean = false;
    let simResult: any = null;
    let simError: string = '';

    // Copy to clipboard notification state
    let copiedText: string | null = null;
    let copyTimeout: ReturnType<typeof setTimeout> | null = null;

    // Modal States
    let showCreateModal: boolean = false;
    let showEditModal: boolean = false;
    let showSecretModal: boolean = false;
    let showDeleteModal: boolean = false;

    // Form data for create/edit
    let selectedClient: OAuthClient | null = null;
    let formName: string = '';
    let formDescription: string = '';
    let formIconUrl: string = '';
    let formRedirectUris: string = '';
    let formOrigins: string = '';
    let formScopes: string = 'profile email';
    let formIsTrusted: boolean = false;
    let formIsActive: boolean = true;
    let formGenerateSecret: boolean = true;
    let formSubmitting: boolean = false;
    let formError: string = '';

    // Secret Reveal Modal Data
    let newlyCreatedSecret: string | null = null;
    let secretClientName: string = '';

    $: filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              c.client_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (filterStatus === 'active') return c.is_active;
        if (filterStatus === 'inactive') return !c.is_active;
        if (filterStatus === 'trusted') return c.is_trusted;
        return true;
    });

    $: totalActiveClients = clients.filter(c => c.is_active).length;
    $: totalTrustedClients = clients.filter(c => c.is_trusted).length;
    $: totalActiveTokens = clients.reduce((acc, c) => acc + (c.active_tokens_count || 0), 0);

    onMount(async () => {
        loadSavedSecrets();
        await fetchClients();
        generateNewPkcePair();
    });

    function loadSavedSecrets() {
        try {
            const saved = localStorage.getItem('ziqva_oauth_known_secrets');
            if (saved) {
                knownSecrets = JSON.parse(saved);
            }
        } catch {}
    }

    function saveSecretForClient(clientId: string, secret: string) {
        if (!clientId || !secret) return;
        knownSecrets[clientId] = secret;
        try {
            localStorage.setItem('ziqva_oauth_known_secrets', JSON.stringify(knownSecrets));
        } catch {}
    }

    async function fetchClients() {
        loading = true;
        error = '';
        try {
            const res = await fetch('/admin/api/oauth-clients', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                clients = data.data || [];
                if (clients.length > 0) {
                    if (!promptTargetClientId) {
                        syncPromptFromClient(clients[0].client_id);
                    }
                }
            } else {
                error = data.message || 'Gagal memuat daftar aplikasi OAuth.';
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat memuat data.';
        } finally {
            loading = false;
        }
    }

    function syncPromptFromClient(clientId: string) {
        promptTargetClientId = clientId;
        const c = clients.find(item => item.client_id === clientId);
        if (c) {
            if (c.allowed_redirect_uris.length > 0) {
                promptRedirectUri = c.allowed_redirect_uris[0];
            }
            if (c.allowed_scopes) {
                promptScope = c.allowed_scopes;
            }
            promptRequirePkce = !c.has_secret;
            if (knownSecrets[c.client_id]) {
                promptTargetSecret = knownSecrets[c.client_id];
            } else if (!c.has_secret) {
                promptTargetSecret = '';
            } else {
                promptTargetSecret = promptTargetSecret && promptTargetSecret !== '' ? promptTargetSecret : 'YOUR_CLIENT_SECRET';
            }

            pkceClientId = c.client_id;
            if (c.allowed_redirect_uris.length > 0) {
                pkceRedirectUri = c.allowed_redirect_uris[0];
            }
            if (c.allowed_scopes) {
                pkceScope = c.allowed_scopes;
            }
        }
    }

    function copyToClipboard(text: string, label = 'Tersalin!') {
        if (!text) return;
        navigator.clipboard.writeText(text);
        copiedText = label;
        if (copyTimeout) clearTimeout(copyTimeout);
        copyTimeout = setTimeout(() => {
            copiedText = null;
        }, 2500);
    }

    function selectClientForPkce(client: OAuthClient) {
        syncPromptFromClient(client.client_id);
        activeTab = 'pkce-tool';
    }

    function selectClientForVibeCoder(client: OAuthClient) {
        syncPromptFromClient(client.client_id);
        activeTab = 'ai-prompt';
    }

    function selectClientForDocs(client: OAuthClient) {
        syncPromptFromClient(client.client_id);
        activeTab = 'docs';
    }

    function selectClientForSnippets(client: OAuthClient) {
        syncPromptFromClient(client.client_id);
        activeTab = 'snippets';
    }

    // PKCE Helper Generator in Browser (RFC 7636 S256)
    function generateNewPkcePair() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let verifier = '';
        const array = new Uint8Array(64);
        window.crypto.getRandomValues(array);
        for (let i = 0; i < 64; i++) {
            verifier += chars[array[i] % chars.length];
        }
        liveVerifier = verifier;

        // Generate a random CSRF state token
        pkceState = 'state_' + Math.random().toString(36).substring(2, 10);

        // Compute SHA-256 S256 Challenge
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        window.crypto.subtle.digest('SHA-256', data).then(hash => {
            const bytes = new Uint8Array(hash);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            liveChallenge = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        });
    }

    $: activeClient = clients.find(c => c.client_id === promptTargetClientId) || clients[0] || null;

    $: liveAuthUrl = `${window.location.origin}/oauth/authorize?client_id=${encodeURIComponent(promptTargetClientId || 'YOUR_CLIENT_ID')}&redirect_uri=${encodeURIComponent(promptRedirectUri)}&response_type=code&scope=${encodeURIComponent(promptScope)}&state=${encodeURIComponent(pkceState)}&code_challenge=${encodeURIComponent(liveChallenge)}&code_challenge_method=S256`;

    // Reactive Master AI Brief Generator for Vibe Coders
    $: generatedAiPrompt = buildMasterVibePrompt(
        vibeArchPreset,
        promptTargetClientId || 'YOUR_CLIENT_ID',
        promptTargetSecret || (activeClient?.has_secret ? 'YOUR_CLIENT_SECRET' : ''),
        promptRedirectUri || 'http://localhost:3000/callback',
        promptScope || 'profile email',
        promptRequirePkce,
        promptIncludeTests,
        promptIncludeTypes
    );

    function getEnvSnippet() {
        return `ZIQVA_OAUTH_HOST="https://appcenter.ziqva.com"
ZIQVA_CLIENT_ID="${promptTargetClientId || 'YOUR_CLIENT_ID'}"
${promptRequirePkce ? '# Public PKCE Client - No Client Secret' : `ZIQVA_CLIENT_SECRET="${promptTargetSecret || 'YOUR_CLIENT_SECRET'}"`}
ZIQVA_REDIRECT_URI="${promptRedirectUri || 'http://localhost:3000/callback'}"
ZIQVA_SCOPE="${promptScope || 'profile email'}"
SESSION_SECRET="ziqva_secret_session_key_32_chars_min"`;
    }

    function saveManualSecret() {
        if (!promptTargetClientId) return;
        saveSecretForClient(promptTargetClientId, (promptTargetSecret || '').trim());
        copyToClipboard('', 'Client Secret berhasil disimpan di browser!');
    }

    function clearManualSecret() {
        if (!promptTargetClientId) return;
        delete knownSecrets[promptTargetClientId];
        try {
            localStorage.setItem('ziqva_oauth_known_secrets', JSON.stringify(knownSecrets));
        } catch {}
        promptTargetSecret = '';
        copyToClipboard('', 'Client Secret dihapus dari memori browser.');
    }

    function getSpecFileContent(): string {
        const ssoHost = 'https://appcenter.ziqva.com';
        const cName = activeClient?.name || 'Ziqva Client App';
        const cId = promptTargetClientId || 'YOUR_CLIENT_ID';
        const cSec = promptRequirePkce ? '(Tidak Membutuhkan Secret - PKCE Public Client)' : (promptTargetSecret || 'YOUR_CLIENT_SECRET');
        const rUri = promptRedirectUri || 'http://localhost:3000/callback';
        const scopes = promptScope || 'profile email';

        return `# ZIQVA OAUTH 2.0 & SSO INTEGRATION SPECIFICATION
> **Target Application:** ${cName} (\`${cId}\`)
> **Auth Server Host:** \`${ssoHost}\`
> **Client Security Model:** ${promptRequirePkce ? '⚡ Public Client (RFC 7636 PKCE S256)' : '🔑 Confidential Client (Authorization Code + Secret)'}
> **Generated:** ${new Date().toISOString()}

---

## 🤖 INSTRUCTIONS FOR AI CODING AGENTS (Vibe Coder / Cursor / Claude / ChatGPT / Grok)

When integrating or writing authentication for this application, paste this document into your AI prompt bar or pass it with the \`/writing-plans\` command:

\`\`\`text
/writing-plans
Read this entire Ziqva OAuth 2.0 / SSO specification.
Analyze our project code structure, tech stack, and session management.
Create an exhaustive step-by-step checklist to integrate Ziqva SSO authentication.
After approval, generate all necessary files in full with zero placeholder comments.
\`\`\`

---

## 1. PRE-CONFIGURED CREDENTIALS & ENVIRONMENT

Add these exact environment variables to your \`.env\` or secret manager:

\`\`\`env
ZIQVA_OAUTH_HOST="${ssoHost}"
ZIQVA_CLIENT_ID="${cId}"
${promptRequirePkce ? '# Public Client uses PKCE S256 Code Challenge - No Client Secret needed' : `ZIQVA_CLIENT_SECRET="${cSec}"`}
ZIQVA_REDIRECT_URI="${rUri}"
ZIQVA_SCOPE="${scopes}"
SESSION_SECRET="ziqva_session_secret_key_minimum_32_characters"
\`\`\`

---

## 2. OAUTH 2.0 SERVER ENDPOINTS & PROTOCOL SPECIFICATION

### A. Authorization Endpoint (User Login in Browser)
- **URL**: \`${ssoHost}/oauth/authorize\`
- **Method**: \`GET\`
- **Parameters**:
  - \`client_id\`: \`${cId}\` (Required)
  - \`redirect_uri\`: \`${rUri}\` (Required - exact match)
  - \`response_type\`: \`code\` (Required)
  - \`scope\`: \`${scopes}\` (Required)
  - \`state\`: Cryptographically random CSRF token (min 16-32 chars)
${promptRequirePkce ? `  - \`code_challenge\`: Base64URL(SHA-256(code_verifier))\n  - \`code_challenge_method\`: \`S256\`` : ''}

### B. Token Exchange Endpoint (Server-to-Server or PKCE Exchange)
- **URL**: \`${ssoHost}/oauth/token\`
- **Method**: \`POST\`
- **Headers**: \`Content-Type: application/json\`
- **Request Body (Authorization Code)**:
\`\`\`json
{
  "grant_type": "authorization_code",
  "client_id": "${cId}",
  ${promptRequirePkce ? '"code_verifier": "<GENERATED_CODE_VERIFIER>",' : `"client_secret": "${cSec}",`}
  "code": "<AUTH_CODE_FROM_CALLBACK>",
  "redirect_uri": "${rUri}"
}
\`\`\`

- **Success Response (HTTP 200 OK)**:
\`\`\`json
{
  "access_token": "zqv_at_9c72f10b83a04e5d...",
  "token_type": "Bearer",
  "expires_in": 2592000,
  "refresh_token": "zqv_rt_81b3a0c2f718...",
  "scope": "${scopes}"
}
\`\`\`

### C. UserInfo Endpoint (Protected Profile Resource)
- **URL**: \`${ssoHost}/oauth/userinfo\`
- **Method**: \`GET\`
- **Header**: \`Authorization: Bearer <access_token>\`
- **Response (HTTP 200 OK)**:
\`\`\`json
{
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "avatar": "https://appcenter.ziqva.com/uploads/avatar.jpg",
  "verified": true,
  "whatsapp": "081234567890",
  "created_at": 1726740000
}
\`\`\`

### D. Token Revocation & Single Sign-Out (RFC 7009)
- **Revoke Token**: \`POST \${ssoHost}/oauth/revoke\`
  - Body: \`{ "client_id": "\${cId}", \${promptRequirePkce ? '' : \`"client_secret": "\${cSec}", \`}"token": "<token>" }\`
- **End-Session Logout**: \`GET \${ssoHost}/oauth/logout?redirect_uri=https://yourapp.com/login\`

---

## 3. STRICT AI IMPLEMENTATION REQUIREMENTS

1. **CSRF Protection**: Generate a high-entropy random \`state\` string stored in session/cookie before redirecting to \`/oauth/authorize\`. Verify that the \`state\` parameter returned on \`/callback\` matches the stored value.
2. **Secure Token Storage**: Never expose \`access_token\` or \`refresh_token\` in unencrypted browser LocalStorage for backend applications. Use \`HttpOnly\`, \`Secure\`, \`SameSite=Lax\` session cookies.
3. **Automatic Token Refresh**: Check expiration on API calls; when \`access_token\` expires, exchange the \`refresh_token\` automatically and update stored credentials (with Refresh Token Rotation).
4. **Clean Logout**: On user logout, call \`POST /oauth/revoke\` to invalidate tokens on Ziqva Identity Provider and destroy local sessions.
`;
    }

    function downloadSpecFile() {
        const content = getSpecFileContent();
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const safeName = (activeClient ? activeClient.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'SPEC');
        link.setAttribute('download', `ZIQVA_OAUTH2_${safeName}_SPEC.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        copyToClipboard('', 'File ZIQVA_OAUTH2_SPEC.md berhasil didownload!');
    }

    function downloadEnvFile() {
        const content = getEnvSnippet();
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '.env');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        copyToClipboard('', 'File .env berhasil didownload!');
    }

    function downloadCursorrules() {
        const rulesContent = `# .cursorrules - Ziqva OAuth 2.0 / SSO Integration Spec
# Target Client: ${promptTargetClientId} (${activeClient?.name || 'Ziqva App'})
# Generated automatically from AppCenter Admin Hub

${generatedAiPrompt}
`;
        const blob = new Blob([rulesContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '.cursorrules');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        copyToClipboard('', 'File .cursorrules berhasil didownload!');
    }

    $: nodeJsSnippet = `// Express / Node.js OAuth2 Flow (Ziqva Identity)
import express from 'express';

const app = express();
const CLIENT_ID = '${promptTargetClientId || 'YOUR_CLIENT_ID'}';
const CLIENT_SECRET = '${promptRequirePkce ? '' : (promptTargetSecret || 'YOUR_CLIENT_SECRET')}';
const REDIRECT_URI = '${promptRedirectUri || 'http://localhost:3000/callback'}';
const SSO_HOST = 'https://appcenter.ziqva.com';

// 1. Redirect user ke halaman login Ziqva SSO
app.get('/login', (req, res) => {
    const authUrl = \`\${SSO_HOST}/oauth/authorize?\` + new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: '${promptScope || 'profile email'}',
        state: 'csrf_random_string'
    });
    res.redirect(authUrl);
});

// 2. Handle callback & tukar authorization code
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    
    // Tukar code menjadi token
    const tokenRes = await fetch(\`\${SSO_HOST}/oauth/token\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            ${promptRequirePkce ? '// Public client menggunakan code_verifier' : `client_secret: CLIENT_SECRET,`}
            code: code,
            redirect_uri: REDIRECT_URI
        })
    });
    const tokens = await tokenRes.json();

    // Ambil data profil akun Ziqva
    const userRes = await fetch(\`\${SSO_HOST}/oauth/userinfo\`, {
        headers: { 'Authorization': \`Bearer \${tokens.access_token}\` }
    });
    const user = await userRes.json();
    res.json({ message: 'Login Sukses', user, tokens });
});

app.listen(3000, () => console.log('App running on http://localhost:3000'));`;

    $: pythonSnippet = `import requests

CLIENT_ID = "${promptTargetClientId || 'YOUR_CLIENT_ID'}"
CLIENT_SECRET = "${promptRequirePkce ? '' : (promptTargetSecret || 'YOUR_CLIENT_SECRET')}"
REDIRECT_URI = "${promptRedirectUri || 'https://yourapp.com/callback'}"
SSO_HOST = "https://appcenter.ziqva.com"

# Step 1: Tukar Auth Code menjadi Access Token
def exchange_code_for_token(code: str):
    payload = {
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        ${promptRequirePkce ? '# "code_verifier": "<verifier>"' : '"client_secret": CLIENT_SECRET,'}
        "code": code,
        "redirect_uri": REDIRECT_URI
    }
    response = requests.post(f"{SSO_HOST}/oauth/token", json=payload)
    return response.json()

# Step 2: Ambil Informasi Profil Ziqva
def get_user_profile(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{SSO_HOST}/oauth/userinfo", headers=headers)
    return response.json()

# Contoh eksekusi alur callback
tokens = exchange_code_for_token("zqv_code_contoh_123")
if "access_token" in tokens:
    user = get_user_profile(tokens["access_token"])
    print(f"User ID: {user['id']}, Nama: {user['name']}, Email: {user['email']}")`;

    $: phpSnippet = `<?php
$clientId = '${promptTargetClientId || 'YOUR_CLIENT_ID'}';
$clientSecret = '${promptRequirePkce ? '' : (promptTargetSecret || 'YOUR_CLIENT_SECRET')}';
$redirectUri = '${promptRedirectUri || 'https://yourapp.com/callback'}';
$ssoHost = 'https://appcenter.ziqva.com';

$code = $_GET['code'] ?? null;
if (!$code) {
    die("Kode otorisasi tidak ditemukan.");
}

// 1. Penukaran Code ke Access Token
$ch = curl_init("$ssoHost/oauth/token");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'grant_type' => 'authorization_code',
    'client_id' => $clientId,
    'client_secret' => $clientSecret,
    'code' => $code,
    'redirect_uri' => $redirectUri
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
$tokens = json_decode(curl_exec($ch), true);
curl_close($ch);

$accessToken = $tokens['access_token'] ?? null;
if (!$accessToken) {
    die("Gagal mendapatkan Access Token: " . json_encode($tokens));
}

// 2. Ambil Profil User Ziqva
$ch = curl_init("$ssoHost/oauth/userinfo");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken"]);
$user = json_decode(curl_exec($ch), true);
curl_close($ch);

echo "Selamat datang, " . htmlspecialchars($user['name']) . " (" . htmlspecialchars($user['email']) . ")";`;

    $: flutterSnippet = `// Flutter / Dart OAuth2 PKCE Implementation (Public Mobile/Desktop Client)
// import 'dart:convert';
// import 'package:http/http.dart' as http;

class ZiqvaOAuthService {
  static const String clientId = '${promptTargetClientId || 'YOUR_CLIENT_ID'}';
  static const String redirectUri = '${promptRedirectUri || 'myapp://oauth/callback'}';
  static const String ssoHost = 'https://appcenter.ziqva.com';

  // 1. Tukar Code dengan PKCE code_verifier (Tanpa Client Secret)
  static Future<Map<String, dynamic>> exchangeCode(String code, String codeVerifier) async {
    final response = await http.post(
      Uri.parse('\$ssoHost/oauth/token'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'grant_type': 'authorization_code',
        'client_id': clientId,
        'code': code,
        'redirect_uri': redirectUri,
        'code_verifier': codeVerifier,
      }),
    );
    return jsonDecode(response.body);
  }

  // 2. Ambil Profil User
  static Future<Map<String, dynamic>> fetchUserInfo(String accessToken) async {
    final response = await http.get(
      Uri.parse('\$ssoHost/oauth/userinfo'),
      headers: {'Authorization': 'Bearer \$accessToken'},
    );
    return jsonDecode(response.body);
  }
}`;

    $: reactSnippet = `// React / SPA PKCE Client Flow (TypeScript)
const SSO_HOST = 'https://appcenter.ziqva.com';
const CLIENT_ID = '${promptTargetClientId || 'YOUR_CLIENT_ID'}';
const REDIRECT_URI = '${promptRedirectUri || 'http://localhost:3000/callback'}';

// 1. Inisiasi Login PKCE di Browser
export async function startPkceLogin() {
    // Generate Code Verifier (random 64-char string)
    const array = new Uint8Array(64);
    window.crypto.getRandomValues(array);
    const verifier = Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
    sessionStorage.setItem('ziqva_pkce_verifier', verifier);

    // Generate SHA-256 S256 Code Challenge
    const data = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');

    const authUrl = \`\${SSO_HOST}/oauth/authorize?client_id=\${CLIENT_ID}&redirect_uri=\${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(promptScope || 'profile email')}&code_challenge=\${challenge}&code_challenge_method=S256&state=random_state\`;
    window.location.href = authUrl;
}

// 2. Handle Callback di Halaman Redirect
export async function handleOAuthCallback(code: string) {
    const verifier = sessionStorage.getItem('ziqva_pkce_verifier');
    if (!verifier) throw new Error('PKCE verifier tidak ditemukan di session.');

    const res = await fetch(\`\${SSO_HOST}/oauth/token\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier
        })
    });
    return res.json();
}`;

    $: curlSnippet = `# 1. Tukar Authorization Code dengan Token
curl -X POST https://appcenter.ziqva.com/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "authorization_code",
    "client_id": "${promptTargetClientId || 'YOUR_CLIENT_ID'}",
    ${promptRequirePkce ? '"code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",' : `"client_secret": "${promptTargetSecret || 'YOUR_CLIENT_SECRET'}",`}
    "code": "zqv_code_7d2f91a0c8b3e4f5",
    "redirect_uri": "${promptRedirectUri || 'http://localhost:3000/callback'}"
  }'

# 2. Ambil Profil User dengan Access Token
curl -X GET https://appcenter.ziqva.com/oauth/userinfo \\
  -H "Authorization: Bearer zqv_at_9c72f10b83a04e5d"

# 3. Refresh Access Token yang Kedaluwarsa
curl -X POST https://appcenter.ziqva.com/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "refresh_token",
    "client_id": "${promptTargetClientId || 'YOUR_CLIENT_ID'}",
    ${promptRequirePkce ? '' : `"client_secret": "${promptTargetSecret || 'YOUR_CLIENT_SECRET'}",`}
    "refresh_token": "zqv_rt_81b3a0c2f718"
  }'

# 4. Revoke Token (Logout)
curl -X POST https://appcenter.ziqva.com/oauth/revoke \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "${promptTargetClientId || 'YOUR_CLIENT_ID'}",
    "token": "zqv_at_9c72f10b83a04e5d"
  }'`;

    function buildMasterVibePrompt(
        preset: VibeArchPreset,
        clientId: string,
        clientSecret: string,
        redirectUri: string,
        scope: string,
        isPkce: boolean,
        incTests: boolean,
        incTypes: boolean
    ): string {
        const ssoHost = 'https://appcenter.ziqva.com';

        if (preset === 'nextjs-fullstack') {
            return `# MASTER AI BRIEF: Implement Ziqva OAuth 2.0 / SSO in Next.js (App Router)

You are an expert Next.js and TypeScript security engineer. Your task is to integrate Ziqva Single Sign-On (SSO) OAuth 2.0 Identity Provider into this Next.js project using Server Actions, Route Handlers, and secure HttpOnly session cookies.

## 1. Environment & Configuration
Add the following to \`.env.local\`:
\`\`\`env
ZIQVA_OAUTH_HOST="${ssoHost}"
ZIQVA_CLIENT_ID="${clientId}"
ZIQVA_CLIENT_SECRET="${clientSecret}"
ZIQVA_REDIRECT_URI="${redirectUri}"
ZIQVA_SCOPE="${scope}"
SESSION_SECRET="your_32_char_random_session_secret_key"
\`\`\`

## 2. Server Endpoints & Contract
- **Authorization URL**: \`${ssoHost}/oauth/authorize\`
  - Query Params: \`client_id\`, \`redirect_uri\`, \`response_type=code\`, \`scope=${scope}\`, \`state=<random_csrf>\`
- **Token Exchange (POST)**: \`${ssoHost}/oauth/token\`
  - Headers: \`Content-Type: application/json\`
  - Body: \`{ "grant_type": "authorization_code", "client_id": "${clientId}", "client_secret": "${clientSecret}", "code": "...", "redirect_uri": "${redirectUri}" }\`
  - Response (200 OK): \`{ "access_token": "zqv_at_...", "refresh_token": "zqv_rt_...", "expires_in": 2592000, "token_type": "Bearer" }\`
- **UserInfo (GET)**: \`${ssoHost}/oauth/userinfo\`
  - Header: \`Authorization: Bearer <access_token>\`
  - Response: \`{ "name": "...", "email": "...", "avatar": null, "verified": true, "whatsapp": "..." }\`
- **Revoke / Logout (POST)**: \`${ssoHost}/oauth/revoke\`

## 3. Required Files to Create
1. \`lib/auth/ziqva-oauth.ts\`: OAuth client functions (\`getAuthorizationUrl()\`, \`exchangeCodeForTokens()\`, \`fetchZiqvaUser()\`, \`refreshTokens()\`, \`revokeToken()\`).
2. \`app/api/auth/login/route.ts\`: Route handler to generate CSRF \`state\` cookie and redirect user to Ziqva SSO.
3. \`app/api/auth/callback/route.ts\`: Route handler to validate \`state\`, exchange \`code\` for tokens, fetch userinfo, save session cookie, and redirect to dashboard.
4. \`app/api/auth/logout/route.ts\`: Route handler to revoke token and clear session cookies.
5. \`lib/auth/session.ts\`: JWT/Encrypted cookie session management helper for Server Components.

## 4. Implementation Rules
- Verify CSRF \`state\` strictly in callback route.
- Store tokens only in HttpOnly, Secure, SameSite=Lax cookies.
- Handle token refresh automatically when access_token expires.
${incTypes ? '- Define strict TypeScript interfaces for token response and user profile.' : ''}
${incTests ? '- Write unit tests verifying state validation and token exchange mocking.' : ''}

Generate an exhaustive step-by-step implementation plan (/writing-plans) first, then write all complete files.`;
        }

        if (preset === 'flutter-pkce') {
            return `# MASTER AI BRIEF: Implement Ziqva OAuth 2.0 PKCE in Flutter (Mobile & Desktop)

You are an expert Flutter & Dart mobile security engineer. Your task is to integrate Ziqva Single Sign-On (SSO) OAuth 2.0 with RFC 7636 PKCE (S256) into this Flutter app without using or exposing a Client Secret.

## 1. App Configuration
- **Host**: \`${ssoHost}\`
- **Client ID**: \`${clientId}\`
- **Redirect URI (Deep Link)**: \`${redirectUri}\` (e.g. \`myapp://oauth/callback\`)
- **Scope**: \`${scope}\`
- **Flow**: Authorization Code Grant with PKCE SHA-256 S256 Challenge.

## 2. Protocol Details
1. **Generate PKCE Pair in Dart**:
   - \`code_verifier\`: Random 64-character URL-safe string (\`[A-Za-z0-9-._~]\`).
   - \`code_challenge\`: \`base64Url.encode(sha256.convert(utf8.encode(codeVerifier)).bytes).replaceAll('=', '')\`
2. **Launch Web Auth Flow**:
   - URL: \`${ssoHost}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&code_challenge=<challenge>&code_challenge_method=S256&state=<csrf_state>\`
   - Use \`flutter_web_auth_2\` or custom deep link listener.
3. **Token Exchange (POST)**:
   - URL: \`${ssoHost}/oauth/token\`
   - Body: \`{ "grant_type": "authorization_code", "client_id": "${clientId}", "code": "<code>", "redirect_uri": "${redirectUri}", "code_verifier": "<verifier>" }\`
4. **Fetch User Info (GET)**:
   - URL: \`${ssoHost}/oauth/userinfo\` with \`Authorization: Bearer <access_token>\`.
5. **Secure Storage**:
   - Save \`access_token\` and \`refresh_token\` in \`flutter_secure_storage\`.

## 3. Required Deliverables
1. \`lib/services/ziqva_oauth_service.dart\`: Complete PKCE generation, authentication trigger, token exchange, auto-refresh, and logout.
2. \`lib/models/ziqva_user.dart\`: User profile model with \`fromJson\` factory.
3. \`lib/providers/auth_provider.dart\`: State management (Riverpod/Bloc/Provider) handling login state.
4. Deep link configuration instructions for Android (\`AndroidManifest.xml\`) and iOS (\`Info.plist\`).

Write clean, robust Dart code with comprehensive error handling and offline state preservation.`;
        }

        if (preset === 'python-fastapi') {
            return `# MASTER AI BRIEF: Implement Ziqva OAuth 2.0 SSO in Python (FastAPI / Requests)

You are an expert Python backend engineer. Your task is to integrate Ziqva Single Sign-On (SSO) OAuth 2.0 Identity Provider into this FastAPI application.

## 1. Environment Variables (\`.env\`)
\`\`\`env
ZIQVA_OAUTH_HOST="${ssoHost}"
ZIQVA_CLIENT_ID="${clientId}"
ZIQVA_CLIENT_SECRET="${clientSecret}"
ZIQVA_REDIRECT_URI="${redirectUri}"
ZIQVA_SCOPE="${scope}"
SECRET_KEY="your_secret_session_key"
\`\`\`

## 2. API Contract & Endpoints
- **Authorize URL**: \`${ssoHost}/oauth/authorize\`
- **Token Endpoint (POST)**: \`${ssoHost}/oauth/token\`
  - Payload: \`{ "grant_type": "authorization_code", "client_id": "${clientId}", "client_secret": "${clientSecret}", "code": code, "redirect_uri": "${redirectUri}" }\`
- **UserInfo Endpoint (GET)**: \`${ssoHost}/oauth/userinfo\`
  - Headers: \`{"Authorization": f"Bearer {access_token}"}\`
  - Returns: \`{ "name": str, "email": str, "avatar": None, "verified": bool, "whatsapp": str }\`
- **Revoke Endpoint (POST)**: \`${ssoHost}/oauth/revoke\`

## 3. Required Implementation Files
1. \`app/core/ziqva_oauth.py\`: Async OAuth client utilizing \`httpx\` for token exchange, userinfo fetching, token refresh, and revocation.
2. \`app/api/routes/auth.py\`: FastAPI router with endpoints:
   - \`GET /auth/login\`: Generates state and redirects to Ziqva login.
   - \`GET /auth/callback\`: Handles auth code, exchanges token, retrieves profile, issues app JWT/session cookie.
   - \`POST /auth/logout\`: Revokes Ziqva token and destroys local session.
3. \`app/schemas/user.py\`: Pydantic models for \`ZiqvaUserProfile\` and \`OAuthTokenResponse\`.
4. \`app/core/dependencies.py\`: \`get_current_user\` FastAPI dependency protecting private routes.

Ensure full async/await support, Pydantic v2 schemas, and standard OAuth 2.0 error handling.`;
        }

        if (preset === 'node-express') {
            return `# MASTER AI BRIEF: Implement Ziqva OAuth 2.0 SSO in Node.js (Express & TypeScript)

You are a senior Node.js backend developer. Your task is to integrate Ziqva Single Sign-On (SSO) OAuth 2.0 Identity Provider into this Express application.

## 1. Environment Variables (\`.env\`)
\`\`\`env
ZIQVA_OAUTH_HOST="${ssoHost}"
ZIQVA_CLIENT_ID="${clientId}"
ZIQVA_CLIENT_SECRET="${clientSecret}"
ZIQVA_REDIRECT_URI="${redirectUri}"
ZIQVA_SCOPE="${scope}"
PORT=3000
\`\`\`

## 2. Endpoints & Protocol
- **Authorize Endpoint**: \`GET ${ssoHost}/oauth/authorize\`
  - Query: \`client_id\`, \`redirect_uri\`, \`response_type=code\`, \`scope=${scope}\`, \`state\`
- **Token Endpoint**: \`POST ${ssoHost}/oauth/token\`
  - Headers: \`Content-Type: application/json\`
  - Body: \`{ "grant_type": "authorization_code", "client_id": "${clientId}", "client_secret": "${clientSecret}", "code": code, "redirect_uri": "${redirectUri}" }\`
- **UserInfo Endpoint**: \`GET ${ssoHost}/oauth/userinfo\`
  - Header: \`Authorization: Bearer <access_token>\`
- **Revoke Endpoint**: \`POST ${ssoHost}/oauth/revoke\`

## 3. Required Deliverables
1. \`src/services/ziqvaAuth.ts\`: Service module containing:
   - \`buildAuthorizeUrl(state: string): string\`
   - \`exchangeCode(code: string): Promise<TokenResponse>\`
   - \`getUserInfo(accessToken: string): Promise<ZiqvaUser>\`
   - \`refreshToken(refreshToken: string): Promise<TokenResponse>\`
   - \`revokeToken(token: string): Promise<boolean>\`
2. \`src/routes/authRoutes.ts\`: Express router for \`/login\`, \`/callback\`, and \`/logout\`.
3. \`src/middlewares/authMiddleware.ts\`: Middleware to guard protected routes using JWT or session.
4. \`src/types/auth.ts\`: Strict TypeScript type definitions.

Write clean, production-ready code with express-session or cookie-session integration.`;
        }

        if (preset === 'react-spa') {
            return `# MASTER AI BRIEF: Implement Ziqva PKCE OAuth 2.0 in React / SPA (TypeScript)

You are a frontend security specialist. Your task is to implement Ziqva Single Sign-On (SSO) OAuth 2.0 in this React SPA using browser-native Web Crypto PKCE (RFC 7636 S256) without exposing any Client Secret.

## 1. Configuration
- **SSO Host**: \`${ssoHost}\`
- **Client ID**: \`${clientId}\`
- **Redirect URI**: \`${redirectUri}\`
- **Scope**: \`${scope}\`

## 2. Web Crypto PKCE Implementation (RFC 7636)
1. **Code Verifier**: 64 random bytes encoded as a URL-safe string. Store in \`sessionStorage\`.
2. **Code Challenge**: \`Base64URL(SHA-256(verifier))\`.
3. **Redirect to Login**: \`${ssoHost}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&code_challenge=<challenge>&code_challenge_method=S256&state=<csrf_state>\`
4. **Callback Token Exchange (POST)**:
   - Endpoint: \`${ssoHost}/oauth/token\`
   - Body: \`{ "grant_type": "authorization_code", "client_id": "${clientId}", "code": code, "redirect_uri": "${redirectUri}", "code_verifier": verifier }\`
5. **Fetch Profile (GET)**:
   - \`${ssoHost}/oauth/userinfo\` with \`Authorization: Bearer <access_token>\`.

## 3. Deliverables
1. \`src/lib/pkceAuth.ts\`: Cryptographic generator, login initiator, and token exchange functions.
2. \`src/context/AuthContext.tsx\`: React Context provider holding \`user\`, \`token\`, \`login()\`, and \`logout()\`.
3. \`src/pages/OAuthCallback.tsx\`: Callback receiver component handling the exchange and redirecting to dashboard.
4. \`src/components/ProtectedRoute.tsx\`: Guard component for private routes.`;
        }

        if (preset === 'php-laravel') {
            return `# MASTER AI BRIEF: Implement Ziqva OAuth 2.0 SSO in PHP (Laravel)

You are an expert Laravel developer and security architect. Your task is to integrate Ziqva Single Sign-On (SSO) OAuth 2.0 Identity Provider into this Laravel application using Guzzle/Http Client and Laravel session management.

## 1. Environment Configuration (\`.env\`)
\`\`\`env
ZIQVA_OAUTH_HOST="${ssoHost}"
ZIQVA_CLIENT_ID="${clientId}"
ZIQVA_CLIENT_SECRET="${clientSecret}"
ZIQVA_REDIRECT_URI="${redirectUri}"
ZIQVA_SCOPE="${scope}"
\`\`\`

## 2. Server Endpoints & Contracts
- **Authorize Endpoint**: \`GET ${ssoHost}/oauth/authorize\`
  - Query: \`client_id\`, \`redirect_uri\`, \`response_type=code\`, \`scope=${scope}\`, \`state\`
- **Token Endpoint**: \`POST ${ssoHost}/oauth/token\`
  - Form/JSON Body: \`grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code={code}&redirect_uri=${redirectUri}\`
- **UserInfo Endpoint**: \`GET ${ssoHost}/oauth/userinfo\`
  - Header: \`Authorization: Bearer {access_token}\`
- **Revoke Endpoint**: \`POST ${ssoHost}/oauth/revoke\`

## 3. Required Deliverables
1. \`config/services.php\`: Add Ziqva credentials array.
2. \`app/Services/ZiqvaOAuthService.php\`: Service handling redirect URL generation, code-for-token exchange via \`Http::asForm()->post()\`, user profile retrieval, and token revocation.
3. \`app/Http/Controllers/Auth/ZiqvaSSOController.php\`: Controller with \`redirect()\`, \`callback()\`, and \`logout()\` actions with strict state validation.
4. \`database/migrations/xxxx_add_ziqva_fields_to_users_table.php\`: Migration adding \`ziqva_email\`, \`ziqva_access_token\`, and \`ziqva_refresh_token\` to \`users\` table.
5. \`routes/web.php\`: Add named auth routes (\`auth.ziqva.redirect\`, \`auth.ziqva.callback\`, \`auth.ziqva.logout\`).

Generate an execution plan (/writing-plans) first, then implement clean, secure Laravel code.`;
        }

        if (preset === 'golang') {
            return `# MASTER AI BRIEF: Implement Ziqva OAuth 2.0 SSO in Go (Golang)

You are an expert Go backend engineer. Your task is to integrate Ziqva Single Sign-On (SSO) OAuth 2.0 Identity Provider into this Go application using \`golang.org/x/oauth2\` or standard HTTP client.

## 1. Configuration (.env or config.yaml)
\`\`\`env
ZIQVA_OAUTH_HOST="${ssoHost}"
ZIQVA_CLIENT_ID="${clientId}"
ZIQVA_CLIENT_SECRET="${clientSecret}"
ZIQVA_REDIRECT_URI="${redirectUri}"
ZIQVA_SCOPE="${scope}"
SESSION_KEY="your-32-byte-secure-session-key"
\`\`\`

## 2. API Contract
- **Authorize Endpoint**: \`GET ${ssoHost}/oauth/authorize\`
- **Token Endpoint**: \`POST ${ssoHost}/oauth/token\`
- **UserInfo Endpoint**: \`GET ${ssoHost}/oauth/userinfo\` (Header: \`Bearer <access_token>\`)
- **Revoke Endpoint**: \`POST ${ssoHost}/oauth/revoke\`

## 3. Required Deliverables
1. \`internal/auth/ziqva.go\`: Structs and methods for OAuth2 config, token exchange, user profile fetching, and token revocation.
2. \`internal/handlers/auth.go\`: HTTP handlers for \`/auth/login\` (generate state cookie & redirect), \`/auth/callback\` (validate state, exchange code, retrieve profile, set session cookie), and \`/auth/logout\`.
3. \`internal/models/user.go\`: Structs for Ziqva token response and user profile.
4. \`internal/middleware/auth.go\`: Session validation middleware for protecting private routes.

Generate an execution plan (/writing-plans) first, then write robust, idiomatic Go code with complete error handling.`;
        }

        // Default: Master Plan & Complete Architecture Blueprint
        return `# MASTER ARCHITECTURE SPECIFICATION & AI WRITING-PLANS
# Ziqva SSO & OAuth 2.0 Identity Provider Integration (RFC 6749, RFC 7636, RFC 7009)

You are a Principal Software Architect and Security Engineer. Integrate Single Sign-On (SSO) with Ziqva Identity Hub into this application.

## 1. Target Credentials & Configuration
- **Authorization Server Base URL**: \`${ssoHost}\`
- **Client ID**: \`${clientId}\`
- **Client Secret**: \`${isPkce ? '(None - Public PKCE Client)' : clientSecret}\`
- **Allowed Redirect URI**: \`${redirectUri}\`
- **Requested Scopes**: \`${scope}\`
- **Client Type**: \`${isPkce ? 'Public Client (RFC 7636 PKCE S256)' : 'Confidential Client (Authorization Code + Secret)'}\`

## 2. Complete API Contracts
### A. Authorization Endpoint (Browser Redirect)
- **Method**: \`GET ${ssoHost}/oauth/authorize\`
- **Query Parameters**:
  - \`client_id\`: \`${clientId}\` (Required)
  - \`redirect_uri\`: \`${redirectUri}\` (Required, exact match)
  - \`response_type\`: \`code\` (Required)
  - \`scope\`: \`${scope}\` (Required)
  - \`state\`: \`<crypto_random_32_chars>\` (Required for CSRF protection)
${isPkce ? `  - \`code_challenge\`: Base64URL-encoded SHA-256 hash of \`code_verifier\`\n  - \`code_challenge_method\`: \`S256\`` : ''}

### B. Token Exchange Endpoint
- **Method**: \`POST ${ssoHost}/oauth/token\`
- **Headers**: \`Content-Type: application/json\` (or \`application/x-www-form-urlencoded\`)
- **Body (Authorization Code Grant)**:
\`\`\`json
{
  "grant_type": "authorization_code",
  "client_id": "${clientId}",
  ${isPkce ? `"code_verifier": "<original_code_verifier>",` : `"client_secret": "${clientSecret}",`}
  "code": "<code_from_callback>",
  "redirect_uri": "${redirectUri}"
}
\`\`\`
- **Response (200 OK)**:
\`\`\`json
{
  "access_token": "zqv_at_9c72f10b...",
  "token_type": "Bearer",
  "expires_in": 2592000,
  "refresh_token": "zqv_rt_81b3a0c2...",
  "scope": "${scope}"
}
\`\`\`

### C. User Profile Resource Endpoint
- **Method**: \`GET ${ssoHost}/oauth/userinfo\`
- **Header**: \`Authorization: Bearer <access_token>\`
- **Response (200 OK)**:
\`\`\`json
{
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "avatar": "https://appcenter.ziqva.com/uploads/avatar.jpg",
  "verified": true,
  "whatsapp": "081234567890",
  "created_at": 1726740000
}
\`\`\`

### D. Token Revocation & Single Sign-Out (RFC 7009)
- **Method (Revoke)**: \`POST ${ssoHost}/oauth/revoke\`
- **Body**: \`{ "client_id": "${clientId}", "token": "<access_or_refresh_token>" }\`
- **Method (Logout Redirect)**: \`GET ${ssoHost}/oauth/logout?redirect_uri=https://yourapp.com/login\`

## 3. TypeScript Type Definitions
\`\`\`typescript
export interface ZiqvaTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface ZiqvaUserInfo {
  name: string;
  email: string;
  avatar: string | null;
  verified: boolean;
  whatsapp?: string | null;
  created_at: number;
}
\`\`\`

## 4. Execution Plan (/writing-plans)
Before writing any code, produce an implementation plan following this checklist:
- [ ] Task 1: Environment configuration & OAuth client SDK helper
- [ ] Task 2: Login initiation route with secure CSRF \`state\` generation
- [ ] Task 3: Callback route with code exchange & user profile sync
- [ ] Task 4: User session establishment (HttpOnly cookie or JWT)
- [ ] Task 5: Background token auto-refresh & session expiry handling
- [ ] Task 6: Logout route with RFC 7009 token revocation
- [ ] Task 7: Protected route guards & UI login button

Proceed to implement all tasks in full without leaving placeholders.`;
    }

    function downloadPromptFile() {
        const blob = new Blob([generatedAiPrompt], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ZIQVA_OAUTH2_SPEC_${vibeArchPreset.toUpperCase()}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        copyToClipboard('', 'File spesifikasi ZIQVA_OAUTH2_SPEC.md berhasil didownload!');
    }

    async function handleSimulateTokenExchange() {
        if (!simCode.trim()) {
            simError = 'Masukkan kode otorisasi (code) terlebih dahulu.';
            return;
        }
        simLoading = true;
        simError = '';
        simResult = null;

        try {
            const payload: any = {
                grant_type: 'authorization_code',
                client_id: pkceClientId,
                code: simCode.trim(),
                redirect_uri: pkceRedirectUri,
                code_verifier: liveVerifier
            };

            const res = await fetch('/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                simResult = data;
            } else {
                simError = `${data.error || 'error'}: ${data.error_description || 'Gagal menukar token'}`;
            }
        } catch (e: any) {
            simError = 'Gagal menghubungi endpoint token server.';
        } finally {
            simLoading = false;
        }
    }

    function openCreateModal() {
        formName = '';
        formDescription = '';
        formIconUrl = '';
        formRedirectUris = 'https://app.example.com/callback\nhttp://localhost:3000/callback';
        formOrigins = 'https://app.example.com\nhttp://localhost:3000';
        formScopes = 'profile email';
        formIsTrusted = false;
        formIsActive = true;
        formGenerateSecret = true;
        formError = '';
        showCreateModal = true;
    }

    function openEditModal(client: OAuthClient) {
        selectedClient = client;
        formName = client.name;
        formDescription = client.description || '';
        formIconUrl = client.icon_url || '';
        formRedirectUris = (client.allowed_redirect_uris || []).join('\n');
        formOrigins = (client.allowed_origins || []).join('\n');
        formScopes = client.allowed_scopes || 'profile email';
        formIsTrusted = client.is_trusted;
        formIsActive = client.is_active;
        formError = '';
        showEditModal = true;
    }

    function openDeleteModal(client: OAuthClient) {
        selectedClient = client;
        showDeleteModal = true;
    }

    async function handleCreateClient() {
        if (!formName.trim()) {
            formError = 'Nama aplikasi wajib diisi.';
            return;
        }

        const uris = formRedirectUris.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
        if (uris.length === 0) {
            formError = 'Minimal satu Allowed Redirect URI wajib diisi.';
            return;
        }

        formSubmitting = true;
        formError = '';

        try {
            const origins = formOrigins.split(/[\n,]+/).map(o => o.trim()).filter(Boolean);

            const res = await fetch('/admin/api/oauth-clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: formName.trim(),
                    description: formDescription.trim() || undefined,
                    icon_url: formIconUrl.trim() || undefined,
                    allowed_redirect_uris: uris,
                    allowed_origins: origins,
                    allowed_scopes: formScopes.trim(),
                    is_trusted: formIsTrusted,
                    generate_secret: formGenerateSecret
                })
            });

            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showCreateModal = false;
                await fetchClients();

                if (data.raw_client_secret && data.data?.client_id) {
                    saveSecretForClient(data.data.client_id, data.raw_client_secret);
                    syncPromptFromClient(data.data.client_id);
                    newlyCreatedSecret = data.raw_client_secret;
                    secretClientName = formName.trim();
                    showSecretModal = true;
                } else if (data.data?.client_id) {
                    syncPromptFromClient(data.data.client_id);
                    successMessage = 'Aplikasi OAuth berhasil didaftarkan.';
                    setTimeout(() => successMessage = '', 4000);
                } else {
                    successMessage = 'Aplikasi OAuth berhasil didaftarkan.';
                    setTimeout(() => successMessage = '', 4000);
                }
            } else {
                formError = data.message || 'Gagal mendaftarkan aplikasi.';
            }
        } catch {
            formError = 'Terjadi kesalahan sistem saat mendaftarkan aplikasi.';
        } finally {
            formSubmitting = false;
        }
    }

    async function handleUpdateClient() {
        if (!selectedClient) return;

        if (!formName.trim()) {
            formError = 'Nama aplikasi wajib diisi.';
            return;
        }

        const uris = formRedirectUris.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
        if (uris.length === 0) {
            formError = 'Minimal satu Allowed Redirect URI wajib diisi.';
            return;
        }

        formSubmitting = true;
        formError = '';

        try {
            const origins = formOrigins.split(/[\n,]+/).map(o => o.trim()).filter(Boolean);

            const res = await fetch(`/admin/api/oauth-clients/${selectedClient.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: formName.trim(),
                    description: formDescription.trim() || undefined,
                    icon_url: formIconUrl.trim() || undefined,
                    allowed_redirect_uris: uris,
                    allowed_origins: origins,
                    allowed_scopes: formScopes.trim(),
                    is_trusted: formIsTrusted,
                    is_active: formIsActive
                })
            });

            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showEditModal = false;
                successMessage = 'Aplikasi OAuth berhasil diperbarui.';
                setTimeout(() => successMessage = '', 4000);
                await fetchClients();
            } else {
                formError = data.message || 'Gagal memperbarui aplikasi.';
            }
        } catch {
            formError = 'Terjadi kesalahan sistem saat memperbarui aplikasi.';
        } finally {
            formSubmitting = false;
        }
    }

    async function handleResetSecret(client: OAuthClient) {
        if (!confirm(`Buat ulang Client Secret untuk "${client.name}"?\n\nPERINGATAN: Secret lama akan langsung tidak berlaku dan aplikasi eksternal harus diperbarui dengan secret baru.`)) {
            return;
        }

        try {
            const res = await fetch(`/admin/api/oauth-clients/${client.id}/reset-secret`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok && data.status === 'success' && data.raw_client_secret) {
                saveSecretForClient(client.client_id, data.raw_client_secret);
                syncPromptFromClient(client.client_id);
                newlyCreatedSecret = data.raw_client_secret;
                secretClientName = client.name;
                showSecretModal = true;
                await fetchClients();
            } else {
                alert(data.message || 'Gagal mereset secret.');
            }
        } catch {
            alert('Terjadi kesalahan sistem saat mereset secret.');
        }
    }

    async function handleDeleteClient() {
        if (!selectedClient) return;
        formSubmitting = true;

        try {
            const res = await fetch(`/admin/api/oauth-clients/${selectedClient.id}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                showDeleteModal = false;
                successMessage = 'Aplikasi OAuth berhasil dihapus.';
                setTimeout(() => successMessage = '', 4000);
                await fetchClients();
            } else {
                alert(data.message || 'Gagal menghapus aplikasi.');
            }
        } catch {
            alert('Terjadi kesalahan sistem saat menghapus aplikasi.');
        } finally {
            formSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>OAuth 2.0 & SSO Identity Server - Admin Appcenter</title>
</svelte:head>

<AdminLayout activePage="oauth-clients" eyebrow="PANEL ADMIN ZIQVA">
    <main class="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">

        <!-- Global Toast Alert -->
        {#if copiedText}
            <div class="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-semibold shadow-2xl border border-emerald-400/40 animate-fade-in backdrop-blur-md">
                <svg class="w-4 h-4 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{copiedText}</span>
            </div>
        {/if}

        {#if successMessage}
            <div class="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-medium animate-fade-in">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{successMessage}</span>
            </div>
        {/if}

        {#if error}
            <div class="flex items-center justify-between gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium animate-fade-in">
                <div class="flex items-center gap-2.5">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                </div>
                <button on:click={fetchClients} class="underline text-xs font-bold hover:text-rose-700 cursor-pointer">Coba Lagi</button>
            </div>
        {/if}

        <!-- Page Header & Action Banner -->
        <div class="relative overflow-hidden rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-8 shadow-xs">
            <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div class="space-y-2">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                        <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Ziqva SSO & Identity Provider (RFC 6749, RFC 7636 PKCE S256, RFC 7009)
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-extrabold text-[var(--text)] tracking-tight">
                        OAuth 2.0 & Single Sign-On
                    </h1>
                    <p class="text-xs sm:text-sm text-[var(--text-3)] max-w-2xl leading-relaxed">
                        Layanan otentikasi akun Ziqva terpusat (seperti Google Sign-In). Kelola kredensial aplikasi klien, whitelist redirect URI, serta integrasikan SSO ke web, desktop, dan mobile app.
                    </p>
                </div>

                <div class="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                    <button
                        on:click={() => activeTab = 'ai-prompt'}
                        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/25 transition-all cursor-pointer border-0 active:scale-[0.98]"
                    >
                        <span>🤖 Prompt AI Vibe Coder</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] bg-white/20 font-mono">Ready</span>
                    </button>

                    <button
                        on:click={() => activeTab = 'docs'}
                        class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                        <svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span>Dokumentasi API</span>
                    </button>

                    <button
                        on:click={openCreateModal}
                        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer border-0"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Daftarkan Aplikasi</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Stats Overview Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Aplikasi Terdaftar</span>
                    <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                </div>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="text-2xl font-bold text-[var(--text)]">{clients.length}</span>
                    <span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">({totalActiveClients} aktif)</span>
                </div>
            </div>

            <div class="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Aplikasi Trusted</span>
                    <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                </div>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="text-2xl font-bold text-[var(--text)]">{totalTrustedClients}</span>
                    <span class="text-xs text-[var(--text-3)]">Bypass layar izin</span>
                </div>
            </div>

            <div class="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Token Sesi Aktif</span>
                    <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                </div>
                <div class="mt-2 flex items-baseline gap-2">
                    <span class="text-2xl font-bold text-[var(--text)]">{totalActiveTokens}</span>
                    <span class="text-xs text-[var(--text-3)]">User terhubung</span>
                </div>
            </div>

            <div class="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Base Host URL</span>
                    <div class="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    </div>
                </div>
                <div class="mt-2 flex items-center justify-between gap-1">
                    <span class="text-xs font-mono text-purple-600 dark:text-purple-400 truncate">appcenter.ziqva.com</span>
                    <button
                        on:click={() => copyToClipboard('https://appcenter.ziqva.com', 'Base URL tersalin!')}
                        class="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-semibold cursor-pointer"
                    >
                        Salin
                    </button>
                </div>
            </div>
        </div>

        <!-- Main Navigation Segmented Tabs Bar -->
        <div class="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-x-auto shadow-xs">
            <button
                on:click={() => activeTab = 'apps'}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap {activeTab === 'apps' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Aplikasi Klien ({clients.length})</span>
            </button>

            <!-- Vibe Coder / AI Prompt Generator Tab -->
            <button
                on:click={() => activeTab = 'ai-prompt'}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap {activeTab === 'ai-prompt' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25' : 'text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25'}"
            >
                <span class="text-sm">🤖</span>
                <span>AI Prompt & Vibe Coder</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-white/25 text-white uppercase tracking-wide">Ready</span>
            </button>

            <button
                on:click={() => activeTab = 'docs'}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap {activeTab === 'docs' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Dokumentasi & API Reference</span>
            </button>

            <button
                on:click={() => activeTab = 'snippets'}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap {activeTab === 'snippets' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Contoh Integrasi Kode</span>
            </button>

            <button
                on:click={() => activeTab = 'pkce-tool'}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap {activeTab === 'pkce-tool' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>PKCE Tester & Live Simulator</span>
            </button>

            <button
                on:click={() => activeTab = 'errors'}
                class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap {activeTab === 'errors' ? 'bg-blue-600 text-white shadow-sm' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]'}"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Daftar Error RFC</span>
            </button>
        </div>

        <!-- ============================================================== -->
        <!-- TAB: VIBE CODER & AI PROMPT GENERATOR                          -->
        <!-- ============================================================== -->
        {#if activeTab === 'ai-prompt'}
            <div class="space-y-6 animate-fade-in">
                <!-- Vibe Coder Intro Card -->
                <div class="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-purple-900/20 via-[var(--surface)] to-indigo-900/20 border border-purple-500/30 shadow-sm space-y-4">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div class="space-y-1.5">
                            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-xs font-bold">
                                <span>⚡ Vibe Coder Prompt Pack</span>
                                <span>•</span>
                                <span>Zero-Hallucination AI Briefing</span>
                            </div>
                            <h2 class="text-xl sm:text-2xl font-black text-[var(--text)] tracking-tight">
                                Brief AI & Writing-Plans Generator
                            </h2>
                            <p class="text-xs sm:text-sm text-[var(--text-3)] max-w-2xl leading-relaxed">
                                Hasilkan prompt spesifikasi teknis lengkap yang siap di-<em>copy-paste</em> langsung ke Cursor Composer, Windsurf Cascade, Claude Code, Grok, ChatGPT, atau file <code>.cursorrules</code> / <code>/writing-plans</code>. AI coding agent Anda akan langsung mengimplementasikan integrasi SSO secara akurat tanpa salah endpoint atau parameter!
                            </p>
                        </div>

                        <div class="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                            <button
                                on:click={() => copyToClipboard(generatedAiPrompt, 'Prompt AI Lengkap Tersalin!')}
                                class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer border-0"
                            >
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Salin Prompt AI Siap Pakai</span>
                            </button>

                            <button
                                on:click={downloadPromptFile}
                                class="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-bold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download sebagai file Markdown"
                            >
                                <svg class="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download .md</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Unified Active Client Selector Card -->
                <div class="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div class="flex items-center gap-3.5 flex-1 min-w-0">
                            {#if activeClient?.icon_url}
                                <img
                                    src={activeClient.icon_url}
                                    alt={activeClient.name}
                                    class="w-12 h-12 rounded-2xl object-cover border border-[var(--border)] bg-[var(--surface-2)] shadow-xs flex-shrink-0"
                                    on:error={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            {:else}
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg flex-shrink-0 shadow-md">
                                    {activeClient ? activeClient.name.charAt(0).toUpperCase() : 'Z'}
                                </div>
                            {/if}

                            <div class="space-y-1 flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Aplikasi Target:</span>
                                    {#if activeClient?.is_trusted}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                            🛡️ Trusted
                                        </span>
                                    {/if}
                                    {#if activeClient?.has_secret}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-mono">
                                            🔑 Confidential App
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                                            ⚡ Public PKCE App
                                        </span>
                                    {/if}
                                </div>

                                <div class="flex items-center gap-2">
                                    <select
                                        value={promptTargetClientId}
                                        on:change={(e) => syncPromptFromClient(e.currentTarget.value)}
                                        class="w-full max-w-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-bold text-xs focus:outline-none focus:border-purple-500 cursor-pointer"
                                    >
                                        {#each clients as c}
                                            <option value={c.client_id}>{c.name} ({c.client_id})</option>
                                        {/each}
                                        {#if clients.length === 0}
                                            <option value="YOUR_CLIENT_ID">Belum ada klien (Gunakan Template)</option>
                                        {/if}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- 1-Click Action Export Buttons -->
                        <div class="flex items-center gap-2 flex-wrap flex-shrink-0">
                            <button
                                on:click={() => copyToClipboard(generatedAiPrompt, 'Prompt AI Lengkap Tersalin!')}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer border-0"
                                title="Salin Master AI Prompt & Writing Plan"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Salin Prompt AI</span>
                            </button>

                            <button
                                on:click={downloadSpecFile}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file Markdown spesifikasi Ziqva OAuth"
                            >
                                <svg class="w-3.5 h-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download Spec (.md)</span>
                            </button>

                            <button
                                on:click={downloadCursorrules}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file .cursorrules untuk Cursor IDE"
                            >
                                <span class="text-xs">⚡</span>
                                <span>.cursorrules</span>
                            </button>

                            <button
                                on:click={downloadEnvFile}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file .env siap pakai"
                            >
                                <span class="text-xs">🔐</span>
                                <span>.env</span>
                            </button>
                        </div>
                    </div>

                    <!-- Active Client Credentials Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1 border-t border-[var(--border)]">
                        <!-- Client ID -->
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-semibold text-[var(--text-2)]">Client ID:</span>
                                <button
                                    on:click={() => copyToClipboard(promptTargetClientId, 'Client ID tersalin!')}
                                    class="text-[10px] text-blue-500 hover:underline cursor-pointer"
                                >
                                    Salin
                                </button>
                            </div>
                            <input
                                type="text"
                                readonly
                                value={promptTargetClientId || 'YOUR_CLIENT_ID'}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-blue-600 dark:text-blue-400 font-mono text-xs select-all focus:outline-none"
                            />
                        </div>

                        <!-- Client Secret -->
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-semibold text-[var(--text-2)]">Client Secret:</span>
                                {#if activeClient?.has_secret}
                                    <div class="flex items-center gap-1.5">
                                        <button
                                            on:click={() => showSecretInSelector = !showSecretInSelector}
                                            class="text-[10px] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                                        >
                                            {showSecretInSelector ? 'Sembunyikan' : 'Tampilkan'}
                                        </button>
                                        {#if knownSecrets[promptTargetClientId]}
                                            <span class="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Tersimpan</span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>

                            {#if activeClient?.has_secret}
                                <div class="flex items-center gap-1.5">
                                    {#if showSecretInSelector}
                                        <input
                                            type="text"
                                            bind:value={promptTargetSecret}
                                            placeholder="Tempel Client Secret"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-purple-500"
                                        />
                                    {:else}
                                        <input
                                            type="password"
                                            bind:value={promptTargetSecret}
                                            placeholder="Tempel Client Secret"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-purple-500"
                                        />
                                    {/if}
                                    <button
                                        on:click={saveManualSecret}
                                        class="p-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 cursor-pointer flex-shrink-0"
                                        title="Simpan secret ke memori browser"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                    </button>
                                    {#if knownSecrets[promptTargetClientId]}
                                        <button
                                            on:click={clearManualSecret}
                                            class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer flex-shrink-0"
                                            title="Hapus secret dari browser"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    {/if}
                                </div>
                            {:else}
                                <div class="py-1.5 px-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[11px] font-medium truncate">
                                    ⚡ PKCE Flow (Tanpa Secret)
                                </div>
                            {/if}
                        </div>

                        <!-- Redirect URI -->
                        <div class="space-y-1">
                            <span class="font-semibold text-[var(--text-2)] block">Redirect URI:</span>
                            {#if activeClient && activeClient.allowed_redirect_uris && activeClient.allowed_redirect_uris.length > 1}
                                <select
                                    bind:value={promptRedirectUri}
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-purple-500"
                                >
                                    {#each activeClient.allowed_redirect_uris as uri}
                                        <option value={uri}>{uri}</option>
                                    {/each}
                                </select>
                            {:else}
                                <input
                                    type="text"
                                    bind:value={promptRedirectUri}
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-purple-500"
                                />
                            {/if}
                        </div>

                        <!-- Scope -->
                        <div class="space-y-1">
                            <span class="font-semibold text-[var(--text-2)] block">Scope Akses:</span>
                            <input
                                type="text"
                                bind:value={promptScope}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-purple-500"
                            />
                        </div>
                    </div>
                </div>

                <!-- Preset & Customization Toolbar -->
                <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-5">
                    <div>
                        <span class="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider block mb-2">Pilih Stack / Arsitektur Target Anda:</span>
                        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                            <button
                                on:click={() => vibeArchPreset = 'master-plan'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'master-plan' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">📋</span>
                                <span class="font-bold text-xs">Master Plan</span>
                                <span class="text-[10px] opacity-80 leading-tight">/writing-plans</span>
                            </button>

                            <button
                                on:click={() => vibeArchPreset = 'nextjs-fullstack'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'nextjs-fullstack' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">▲</span>
                                <span class="font-bold text-xs">Next.js</span>
                                <span class="text-[10px] opacity-80 leading-tight">App Router</span>
                            </button>

                            <button
                                on:click={() => vibeArchPreset = 'node-express'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'node-express' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">🟢</span>
                                <span class="font-bold text-xs">Express</span>
                                <span class="text-[10px] opacity-80 leading-tight">Node & TS</span>
                            </button>

                            <button
                                on:click={() => vibeArchPreset = 'python-fastapi'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'python-fastapi' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">🐍</span>
                                <span class="font-bold text-xs">FastAPI</span>
                                <span class="text-[10px] opacity-80 leading-tight">Pydantic v2</span>
                            </button>

                            <button
                                on:click={() => vibeArchPreset = 'flutter-pkce'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'flutter-pkce' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">📱</span>
                                <span class="font-bold text-xs">Flutter</span>
                                <span class="text-[10px] opacity-80 leading-tight">PKCE S256</span>
                            </button>

                            <button
                                on:click={() => vibeArchPreset = 'react-spa'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'react-spa' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">⚛️</span>
                                <span class="font-bold text-xs">React SPA</span>
                                <span class="text-[10px] opacity-80 leading-tight">WebCrypto PKCE</span>
                            </button>

                            <button
                                on:click={() => vibeArchPreset = 'php-laravel'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'php-laravel' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">🐘</span>
                                <span class="font-bold text-xs">Laravel</span>
                                <span class="text-[10px] opacity-80 leading-tight">PHP Session</span>
                            </button>

                            <button
                                on:click={() => vibeArchPreset = 'golang'}
                                class="p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1 {vibeArchPreset === 'golang' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]'}"
                            >
                                <span class="text-lg">🐹</span>
                                <span class="font-bold text-xs">Golang</span>
                                <span class="text-[10px] opacity-80 leading-tight">Gin / Fiber</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Prompt Live Preview Box -->
                <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <h3 class="text-sm font-bold text-[var(--text)]">Preview Prompt Markdown Siap Paste</h3>
                            <span class="text-[11px] text-[var(--text-3)]">({generatedAiPrompt.length} karakter)</span>
                        </div>

                        <div class="flex items-center gap-2">
                            <button
                                on:click={() => copyToClipboard(generatedAiPrompt, 'Prompt AI Lengkap Tersalin!')}
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer border-0"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Salin Seluruh Prompt</span>
                            </button>
                        </div>
                    </div>

                    <div class="relative group">
                        <pre class="p-5 rounded-2xl bg-[#090d16] text-purple-200 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 max-h-[500px] select-all whitespace-pre-wrap">{generatedAiPrompt}</pre>
                    </div>

                    <!-- Usage Instructions for Vibe Coders -->
                    <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div class="flex items-start gap-2.5">
                            <span class="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">1</span>
                            <div>
                                <strong class="text-[var(--text)] block">Salin Prompt</strong>
                                <span class="text-[var(--text-3)] text-[11px]">Klik tombol salin di atas untuk mengambil spesifikasi lengkap.</span>
                            </div>
                        </div>

                        <div class="flex items-start gap-2.5">
                            <span class="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">2</span>
                            <div>
                                <strong class="text-[var(--text)] block">Paste ke AI Chat / Rules</strong>
                                <span class="text-[var(--text-3)] text-[11px]">Paste ke Cursor Composer (Ctrl+I), Windsurf, Claude Code, atau simpan ke <code>.cursorrules</code>.</span>
                            </div>
                        </div>

                        <div class="flex items-start gap-2.5">
                            <span class="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">3</span>
                            <div>
                                <strong class="text-[var(--text)] block">AI Menulis Code 100% Pas</strong>
                                <span class="text-[var(--text-3)] text-[11px]">AI akan otomatis membuat file auth, route handler, dan flow SSO tanpa salah parameter!</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {/if}

        <!-- ============================================================== -->
        <!-- TAB 1: DAFTAR APLIKASI KLIEN (APPS)                            -->
        <!-- ============================================================== -->
        {#if activeTab === 'apps'}
            <div class="space-y-4">
                <!-- Filter & Search Toolbar -->
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                    <div class="relative w-full sm:w-80">
                        <span class="absolute left-3.5 top-2.5 text-[var(--text-3)]">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            bind:value={searchQuery}
                            placeholder="Cari nama aplikasi, Client ID..."
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-xl py-2 pl-10 pr-3 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>

                    <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <button
                            on:click={() => filterStatus = 'all'}
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer {filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                        >
                            Semua ({clients.length})
                        </button>
                        <button
                            on:click={() => filterStatus = 'active'}
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer {filterStatus === 'active' ? 'bg-emerald-600 text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                        >
                            Aktif ({totalActiveClients})
                        </button>
                        <button
                            on:click={() => filterStatus = 'trusted'}
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer {filterStatus === 'trusted' ? 'bg-amber-600 text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                        >
                            Trusted ({totalTrustedClients})
                        </button>
                    </div>
                </div>

                <!-- Clients Grid List -->
                {#if loading}
                    <div class="flex flex-col items-center justify-center p-12 text-[var(--text-3)] bg-[var(--surface)] rounded-3xl border border-[var(--border)] shadow-xs">
                        <svg class="w-8 h-8 animate-spin text-blue-500 mb-3" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span class="text-xs font-medium">Memuat data aplikasi OAuth...</span>
                    </div>
                {:else if filteredClients.length === 0}
                    <div class="p-12 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-[var(--text)]">Belum ada aplikasi yang sesuai</h3>
                            <p class="text-xs text-[var(--text-3)] mt-1 max-w-md mx-auto">
                                Daftarkan aplikasi klien pertama Anda untuk menghubungkan fitur login akun Ziqva pada platform eksternal atau aplikasi desktop/mobile Anda.
                            </p>
                        </div>
                        <div class="flex items-center justify-center gap-3 pt-2">
                            <button
                                on:click={openCreateModal}
                                class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer border-0"
                            >
                                + Daftarkan Aplikasi Sekarang
                            </button>
                            <button
                                on:click={() => activeTab = 'ai-prompt'}
                                class="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer border-0"
                            >
                                🤖 Pelajari Prompt AI Vibe Coder
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="grid grid-cols-1 gap-4">
                        {#each filteredClients as client (client.id)}
                            <div class="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs hover:border-blue-500/40 transition-all flex flex-col justify-between gap-5">
                                <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                    
                                    <!-- Left: App Details -->
                                    <div class="flex items-start gap-4">
                                        {#if client.icon_url}
                                            <img
                                                src={client.icon_url}
                                                alt={client.name}
                                                class="w-14 h-14 rounded-2xl object-cover border border-[var(--border)] flex-shrink-0 bg-[var(--surface-2)] shadow-xs"
                                                on:error={(e) => (e.currentTarget.style.display = 'none')}
                                            />
                                        {:else}
                                            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xl flex-shrink-0 shadow-md">
                                                {client.name.charAt(0).toUpperCase()}
                                            </div>
                                        {/if}

                                        <div class="space-y-1.5">
                                            <div class="flex items-center flex-wrap gap-2">
                                                <h3 class="text-base font-bold text-[var(--text)]">{client.name}</h3>
                                                
                                                {#if client.is_trusted}
                                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                                        🛡️ Trusted (First-Party)
                                                    </span>
                                                {/if}

                                                {#if client.is_active}
                                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        Aktif
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                                                        Nonaktif
                                                    </span>
                                                {/if}

                                                {#if client.has_secret}
                                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-mono">
                                                        🔑 Confidential (Secret Hash)
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                                                        ⚡ Public (PKCE Only)
                                                    </span>
                                                {/if}
                                            </div>

                                            {#if client.description}
                                                <p class="text-xs text-[var(--text-3)] leading-relaxed max-w-2xl">{client.description}</p>
                                            {/if}

                                            <!-- Client ID Copy Box -->
                                            <div class="flex items-center gap-2 pt-1 flex-wrap">
                                                <span class="text-xs font-semibold text-[var(--text-3)]">Client ID:</span>
                                                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                                                    <code class="text-blue-600 dark:text-blue-400 font-mono text-xs select-all">{client.client_id}</code>
                                                    <button
                                                        on:click={() => copyToClipboard(client.client_id, 'Client ID tersalin!')}
                                                        class="p-0.5 text-[var(--text-3)] hover:text-blue-500 transition-colors cursor-pointer"
                                                        title="Salin Client ID"
                                                    >
                                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Right: Action Buttons -->
                                    <div class="flex items-center gap-2 flex-wrap self-end lg:self-start">
                                        <button
                                            on:click={() => selectClientForVibeCoder(client)}
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25 text-xs font-semibold transition-all cursor-pointer"
                                            title="Buat AI Prompt & Writing Plan untuk aplikasi ini"
                                        >
                                            <span>🤖 Prompt AI</span>
                                        </button>

                                        <button
                                            on:click={() => selectClientForPkce(client)}
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-xs font-semibold transition-all cursor-pointer"
                                            title="Uji coba otorisasi PKCE untuk aplikasi ini"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            <span>Uji PKCE</span>
                                        </button>

                                        {#if client.has_secret}
                                            <button
                                                on:click={() => handleResetSecret(client)}
                                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-xs font-semibold transition-all cursor-pointer"
                                                title="Generate Client Secret baru"
                                            >
                                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                </svg>
                                                <span>Reset Secret</span>
                                            </button>
                                        {/if}

                                        <button
                                            on:click={() => openEditModal(client)}
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] text-xs font-semibold transition-all cursor-pointer"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            <span>Edit</span>
                                        </button>

                                        <button
                                            on:click={() => openDeleteModal(client)}
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-semibold transition-all cursor-pointer"
                                            title="Hapus aplikasi"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <!-- Technical Details Box -->
                                <div class="pt-4 border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                    <div>
                                        <span class="block font-semibold text-[var(--text-3)] mb-1.5">Allowed Redirect URIs:</span>
                                        <div class="space-y-1">
                                            {#each client.allowed_redirect_uris as uri}
                                                <div class="font-mono text-[11px] text-[var(--text-2)] truncate bg-[var(--surface-2)] px-2.5 py-1 rounded-lg border border-[var(--border)] flex items-center justify-between gap-1" title={uri}>
                                                    <span class="truncate">{uri}</span>
                                                    <button on:click={() => copyToClipboard(uri, 'URI tersalin!')} class="text-[var(--text-3)] hover:text-blue-500 flex-shrink-0 cursor-pointer">
                                                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                    </button>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>

                                    <div>
                                        <span class="block font-semibold text-[var(--text-3)] mb-1.5">Allowed CORS Origins:</span>
                                        {#if (client.allowed_origins || []).length > 0}
                                            <div class="space-y-1">
                                                {#each client.allowed_origins as origin}
                                                    <div class="font-mono text-[11px] text-[var(--text-2)] truncate bg-[var(--surface-2)] px-2.5 py-1 rounded-lg border border-[var(--border)]" title={origin}>
                                                        {origin}
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            <span class="text-[var(--text-3)] italic">Default / All origins allowed</span>
                                        {/if}
                                    </div>

                                    <div>
                                        <span class="block font-semibold text-[var(--text-3)] mb-1.5">Scopes & Statistik:</span>
                                        <div class="flex flex-wrap gap-1">
                                            {#each client.allowed_scopes.split(' ') as sc}
                                                <span class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] border border-blue-500/20">
                                                    {sc}
                                                </span>
                                            {/each}
                                        </div>
                                        <div class="mt-2.5 text-[11px] text-[var(--text-3)] space-y-0.5">
                                            <div>Token aktif: <strong class="text-emerald-600 dark:text-emerald-400">{client.active_tokens_count} sesi</strong></div>
                                            <div>Dibuat: {new Date(client.created_at).toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- ============================================================== -->
        <!-- TAB 2: DOKUMENTASI & API REFERENCE                            -->
        <!-- ============================================================== -->
        {#if activeTab === 'docs'}
            <div class="space-y-6 animate-fade-in">
                <!-- Unified Active Client Selector Card -->
                <div class="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div class="flex items-center gap-3.5 flex-1 min-w-0">
                            {#if activeClient?.icon_url}
                                <img
                                    src={activeClient.icon_url}
                                    alt={activeClient.name}
                                    class="w-12 h-12 rounded-2xl object-cover border border-[var(--border)] bg-[var(--surface-2)] shadow-xs flex-shrink-0"
                                    on:error={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            {:else}
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg flex-shrink-0 shadow-md">
                                    {activeClient ? activeClient.name.charAt(0).toUpperCase() : 'Z'}
                                </div>
                            {/if}

                            <div class="space-y-1 flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Aplikasi Target:</span>
                                    {#if activeClient?.is_trusted}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                            🛡️ Trusted
                                        </span>
                                    {/if}
                                    {#if activeClient?.has_secret}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-mono">
                                            🔑 Confidential App
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                                            ⚡ Public PKCE App
                                        </span>
                                    {/if}
                                </div>

                                <div class="flex items-center gap-2">
                                    <select
                                        value={promptTargetClientId}
                                        on:change={(e) => syncPromptFromClient(e.currentTarget.value)}
                                        class="w-full max-w-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-bold text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                                    >
                                        {#each clients as c}
                                            <option value={c.client_id}>{c.name} ({c.client_id})</option>
                                        {/each}
                                        {#if clients.length === 0}
                                            <option value="YOUR_CLIENT_ID">Belum ada klien (Gunakan Template)</option>
                                        {/if}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- 1-Click Action Export Buttons -->
                        <div class="flex items-center gap-2 flex-wrap flex-shrink-0">
                            <button
                                on:click={() => copyToClipboard(generatedAiPrompt, 'Prompt AI Lengkap Tersalin!')}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer border-0"
                                title="Salin Master AI Prompt & Writing Plan"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Salin Prompt AI</span>
                            </button>

                            <button
                                on:click={downloadSpecFile}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file Markdown spesifikasi Ziqva OAuth"
                            >
                                <svg class="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download Spec (.md)</span>
                            </button>

                            <button
                                on:click={downloadCursorrules}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file .cursorrules untuk Cursor IDE"
                            >
                                <span class="text-xs">⚡</span>
                                <span>.cursorrules</span>
                            </button>

                            <button
                                on:click={downloadEnvFile}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file .env siap pakai"
                            >
                                <span class="text-xs">🔐</span>
                                <span>.env</span>
                            </button>
                        </div>
                    </div>

                    <!-- Active Client Credentials Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1 border-t border-[var(--border)]">
                        <!-- Client ID -->
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-semibold text-[var(--text-2)]">Client ID:</span>
                                <button
                                    on:click={() => copyToClipboard(promptTargetClientId, 'Client ID tersalin!')}
                                    class="text-[10px] text-blue-500 hover:underline cursor-pointer"
                                >
                                    Salin
                                </button>
                            </div>
                            <input
                                type="text"
                                readonly
                                value={promptTargetClientId || 'YOUR_CLIENT_ID'}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-blue-600 dark:text-blue-400 font-mono text-xs select-all focus:outline-none"
                            />
                        </div>

                        <!-- Client Secret -->
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-semibold text-[var(--text-2)]">Client Secret:</span>
                                {#if activeClient?.has_secret}
                                    <div class="flex items-center gap-1.5">
                                        <button
                                            on:click={() => showSecretInSelector = !showSecretInSelector}
                                            class="text-[10px] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                                        >
                                            {showSecretInSelector ? 'Sembunyikan' : 'Tampilkan'}
                                        </button>
                                        {#if knownSecrets[promptTargetClientId]}
                                            <span class="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Tersimpan</span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>

                            {#if activeClient?.has_secret}
                                <div class="flex items-center gap-1.5">
                                    {#if showSecretInSelector}
                                        <input
                                            type="text"
                                            bind:value={promptTargetSecret}
                                            placeholder="Tempel Client Secret"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                        />
                                    {:else}
                                        <input
                                            type="password"
                                            bind:value={promptTargetSecret}
                                            placeholder="Tempel Client Secret"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                        />
                                    {/if}
                                    <button
                                        on:click={saveManualSecret}
                                        class="p-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 cursor-pointer flex-shrink-0"
                                        title="Simpan secret ke memori browser"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                    </button>
                                    {#if knownSecrets[promptTargetClientId]}
                                        <button
                                            on:click={clearManualSecret}
                                            class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer flex-shrink-0"
                                            title="Hapus secret dari browser"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    {/if}
                                </div>
                            {:else}
                                <div class="py-1.5 px-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[11px] font-medium truncate">
                                    ⚡ PKCE Flow (Tanpa Secret)
                                </div>
                            {/if}
                        </div>

                        <!-- Redirect URI -->
                        <div class="space-y-1">
                            <span class="font-semibold text-[var(--text-2)] block">Redirect URI:</span>
                            {#if activeClient && activeClient.allowed_redirect_uris && activeClient.allowed_redirect_uris.length > 1}
                                <select
                                    bind:value={promptRedirectUri}
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                >
                                    {#each activeClient.allowed_redirect_uris as uri}
                                        <option value={uri}>{uri}</option>
                                    {/each}
                                </select>
                            {:else}
                                <input
                                    type="text"
                                    bind:value={promptRedirectUri}
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                />
                            {/if}
                        </div>

                        <!-- Scope -->
                        <div class="space-y-1">
                            <span class="font-semibold text-[var(--text-2)] block">Scope Akses:</span>
                            <input
                                type="text"
                                bind:value={promptScope}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <!-- Overview Card -->
                <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <h2 class="text-lg font-bold text-[var(--text)] flex items-center gap-2">
                        <span>📖 Panduan Integrasi OAuth 2.0 Ziqva Identity</span>
                    </h2>
                    <p class="text-xs sm:text-sm text-[var(--text-3)] leading-relaxed">
                        Ziqva OAuth 2.0 Authorization Server mengimplementasikan spesifikasi standar industri <strong>RFC 6749</strong> (Authorization Framework), <strong>RFC 7636</strong> (PKCE), dan <strong>RFC 7009</strong> (Token Revocation). Dengan protokol ini, aplikasi web, mobile, maupun desktop dapat mengautentikasi pengguna dan mengambil informasi profil akun Ziqva secara aman tanpa perlu mengetahui password pengguna.
                    </p>

                    <!-- Flow Diagram Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                            <div class="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">1</div>
                            <h4 class="text-xs font-bold text-[var(--text)]">Otorisasi Pengguna (Browser)</h4>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">
                                Redirect pengguna ke endpoint <code>/oauth/authorize</code> dengan menyertakan <code>client_id</code>, <code>redirect_uri</code>, dan parameter PKCE (<code>code_challenge</code>).
                            </p>
                        </div>

                        <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                            <div class="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center">2</div>
                            <h4 class="text-xs font-bold text-[var(--text)]">Tukar Kode Otorisasi (Backend/App)</h4>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">
                                Setelah user login & menyetujui consent, kirim POST ke <code>/oauth/token</code> untuk menukar <code>code</code> menjadi <code>access_token</code> dan <code>refresh_token</code>.
                            </p>
                        </div>

                        <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                            <div class="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">3</div>
                            <h4 class="text-xs font-bold text-[var(--text)]">Akses Profil User (Resource)</h4>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">
                                Kirim request ke <code>/oauth/userinfo</code> dengan header <code>Authorization: Bearer &lt;access_token&gt;</code> untuk mendapatkan data user Ziqva.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Endpoints Specification Cards -->
                <div class="space-y-4">
                    <!-- Endpoint 1: Authorize -->
                    <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs">GET</span>
                                <code class="font-mono text-xs font-bold text-[var(--text)]">/oauth/authorize</code>
                            </div>
                            <span class="text-xs text-[var(--text-3)]">Titik masuk otorisasi browser & Google-style Consent</span>
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="border-b border-[var(--border)] text-[var(--text-3)]">
                                        <th class="py-2 pr-4 font-semibold">Parameter</th>
                                        <th class="py-2 px-4 font-semibold">Tipe</th>
                                        <th class="py-2 px-4 font-semibold">Status</th>
                                        <th class="py-2 pl-4 font-semibold">Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-[var(--border)]">
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">client_id</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold">Wajib</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">Client ID yang didaftarkan di panel admin</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">redirect_uri</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String URL</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold">Wajib</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">URL callback target setelah login (harus cocok dengan whitelist)</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">response_type</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold">Wajib</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">Harus bernilai <code class="bg-[var(--surface-2)] px-1.5 py-0.5 rounded">code</code></td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">scope</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 text-[10px] font-bold">Opsional</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">Izin akses dipisah spasi, default: <code class="bg-[var(--surface-2)] px-1.5 py-0.5 rounded">profile email</code></td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">state</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">Disarankan</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">String acak unik dari klien untuk proteksi serangan CSRF</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">code_challenge</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 text-[10px] font-bold">PKCE</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">Base64URL SHA-256 hash dari code_verifier (Wajib untuk Public App)</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">code_challenge_method</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 text-[10px] font-bold">PKCE</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">Metode hash: <code class="bg-[var(--surface-2)] px-1.5 py-0.5 rounded">S256</code> (Disarankan) atau <code class="bg-[var(--surface-2)] px-1.5 py-0.5 rounded">plain</code></td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 pr-4 font-mono text-blue-500 font-semibold">prompt</td>
                                        <td class="py-2.5 px-4 font-mono text-[var(--text-3)]">String</td>
                                        <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 text-[10px] font-bold">Opsional</span></td>
                                        <td class="py-2.5 pl-4 text-[var(--text-2)]">Gunakan <code class="bg-[var(--surface-2)] px-1.5 py-0.5 rounded">consent</code> untuk memaksa menampilkan layar persetujuan</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Endpoint 2: Token Exchange -->
                    <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">POST</span>
                                <code class="font-mono text-xs font-bold text-[var(--text)]">/oauth/token</code>
                            </div>
                            <span class="text-xs text-[var(--text-3)]">Penukaran Code & Refresh Token Rotation</span>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                            <div>
                                <h4 class="font-bold text-[var(--text)] mb-2">Request Body (JSON / x-www-form-urlencoded):</h4>
                                <pre class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[11px] text-blue-500 dark:text-blue-300 overflow-x-auto leading-relaxed select-all">{`{
  "grant_type": "authorization_code", // atau "refresh_token"
  "client_id": "${promptTargetClientId || 'zqv_client_xxx'}",
  ${promptRequirePkce ? '"code_verifier": "my_secret_verifier", // PKCE Flow' : `"client_secret": "${promptTargetSecret || 'zqv_sec_xxx'}",`}
  "code": "zqv_code_7d2f91...",
  "redirect_uri": "${promptRedirectUri || 'https://yourapp.com/callback'}"
}`}</pre>
                            </div>

                            <div>
                                <h4 class="font-bold text-[var(--text)] mb-2">Response JSON (200 OK):</h4>
                                <pre class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[11px] text-emerald-600 dark:text-emerald-300 overflow-x-auto leading-relaxed">{`{
  "access_token": "zqv_at_9c72f10b...",
  "token_type": "Bearer",
  "expires_in": 2592000, // Masa berlaku 30 hari (detik)
  "refresh_token": "zqv_rt_81b3a0c2...", // Masa berlaku 90 hari
  "scope": "${promptScope || 'profile email'}"
}`}</pre>
                            </div>
                        </div>
                    </div>

                    <!-- Endpoint 3: UserInfo -->
                    <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono font-bold text-xs">GET</span>
                                <code class="font-mono text-xs font-bold text-[var(--text)]">/oauth/userinfo</code>
                            </div>
                            <span class="text-xs text-[var(--text-3)]">Profil Pengguna Terautentikasi (Protected Resource)</span>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                            <div>
                                <h4 class="font-bold text-[var(--text)] mb-2">Request Header:</h4>
                                <pre class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[11px] text-purple-500 dark:text-purple-300 overflow-x-auto">{`Authorization: Bearer zqv_at_9c72f10b...`}</pre>
                            </div>

                            <div>
                                <h4 class="font-bold text-[var(--text)] mb-2">Response JSON (200 OK):</h4>
                                <pre class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[11px] text-emerald-600 dark:text-emerald-300 overflow-x-auto leading-relaxed">{`{
  "name": "Budi Santoso",
  "email": "budi@example.com",
  "avatar": "https://appcenter.ziqva.com/uploads/avatar.jpg",
  "verified": true,
  "whatsapp": "081234567890",
  "created_at": 1726740000
}`}</pre>
                            </div>
                        </div>
                    </div>

                    <!-- Endpoint 4: Token Revocation -->
                    <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono font-bold text-xs">POST</span>
                                <code class="font-mono text-xs font-bold text-[var(--text)]">/oauth/revoke</code>
                            </div>
                            <span class="text-xs text-[var(--text-3)]">RFC 7009 Token Revocation (Logout)</span>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                            <div>
                                <h4 class="font-bold text-[var(--text)] mb-2">Request Body (JSON / URL-encoded):</h4>
                                <pre class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[11px] text-rose-500 dark:text-rose-300 overflow-x-auto leading-relaxed select-all">{`{
  "client_id": "${promptTargetClientId || 'zqv_client_xxx'}",
  ${promptRequirePkce ? '' : `"client_secret": "${promptTargetSecret || 'zqv_sec_xxx'}",\n  `}"token": "zqv_at_xxx",
  "token_type_hint": "access_token" // atau "refresh_token"
}`}</pre>
                            </div>

                            <div>
                                <h4 class="font-bold text-[var(--text)] mb-2">Response (200 OK):</h4>
                                <pre class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[11px] text-emerald-600 dark:text-emerald-300 overflow-x-auto leading-relaxed">{`{
  "status": "success",
  "message": "Token berhasil dicabut."
}`}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {/if}

        <!-- ============================================================== -->
        <!-- TAB 3: CONTOH KODE MULTI-BAHASA (SNIPPETS)                     -->
        <!-- ============================================================== -->
        {#if activeTab === 'snippets'}
            <div class="space-y-6 animate-fade-in">
                <!-- Unified Active Client Selector Card -->
                <div class="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div class="flex items-center gap-3.5 flex-1 min-w-0">
                            {#if activeClient?.icon_url}
                                <img
                                    src={activeClient.icon_url}
                                    alt={activeClient.name}
                                    class="w-12 h-12 rounded-2xl object-cover border border-[var(--border)] bg-[var(--surface-2)] shadow-xs flex-shrink-0"
                                    on:error={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            {:else}
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg flex-shrink-0 shadow-md">
                                    {activeClient ? activeClient.name.charAt(0).toUpperCase() : 'Z'}
                                </div>
                            {/if}

                            <div class="space-y-1 flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Aplikasi Target:</span>
                                    {#if activeClient?.is_trusted}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                            🛡️ Trusted
                                        </span>
                                    {/if}
                                    {#if activeClient?.has_secret}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-mono">
                                            🔑 Confidential App
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                                            ⚡ Public PKCE App
                                        </span>
                                    {/if}
                                </div>

                                <div class="flex items-center gap-2">
                                    <select
                                        value={promptTargetClientId}
                                        on:change={(e) => syncPromptFromClient(e.currentTarget.value)}
                                        class="w-full max-w-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-bold text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                                    >
                                        {#each clients as c}
                                            <option value={c.client_id}>{c.name} ({c.client_id})</option>
                                        {/each}
                                        {#if clients.length === 0}
                                            <option value="YOUR_CLIENT_ID">Belum ada klien (Gunakan Template)</option>
                                        {/if}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- 1-Click Action Export Buttons -->
                        <div class="flex items-center gap-2 flex-wrap flex-shrink-0">
                            <button
                                on:click={() => copyToClipboard(generatedAiPrompt, 'Prompt AI Lengkap Tersalin!')}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer border-0"
                                title="Salin Master AI Prompt & Writing Plan"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Salin Prompt AI</span>
                            </button>

                            <button
                                on:click={downloadSpecFile}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file Markdown spesifikasi Ziqva OAuth"
                            >
                                <svg class="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download Spec (.md)</span>
                            </button>

                            <button
                                on:click={downloadCursorrules}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file .cursorrules untuk Cursor IDE"
                            >
                                <span class="text-xs">⚡</span>
                                <span>.cursorrules</span>
                            </button>

                            <button
                                on:click={downloadEnvFile}
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold text-xs shadow-xs transition-all cursor-pointer"
                                title="Download file .env siap pakai"
                            >
                                <span class="text-xs">🔐</span>
                                <span>.env</span>
                            </button>
                        </div>
                    </div>

                    <!-- Active Client Credentials Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1 border-t border-[var(--border)]">
                        <!-- Client ID -->
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-semibold text-[var(--text-2)]">Client ID:</span>
                                <button
                                    on:click={() => copyToClipboard(promptTargetClientId, 'Client ID tersalin!')}
                                    class="text-[10px] text-blue-500 hover:underline cursor-pointer"
                                >
                                    Salin
                                </button>
                            </div>
                            <input
                                type="text"
                                readonly
                                value={promptTargetClientId || 'YOUR_CLIENT_ID'}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-blue-600 dark:text-blue-400 font-mono text-xs select-all focus:outline-none"
                            />
                        </div>

                        <!-- Client Secret -->
                        <div class="space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-semibold text-[var(--text-2)]">Client Secret:</span>
                                {#if activeClient?.has_secret}
                                    <div class="flex items-center gap-1.5">
                                        <button
                                            on:click={() => showSecretInSelector = !showSecretInSelector}
                                            class="text-[10px] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                                        >
                                            {showSecretInSelector ? 'Sembunyikan' : 'Tampilkan'}
                                        </button>
                                        {#if knownSecrets[promptTargetClientId]}
                                            <span class="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Tersimpan</span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>

                            {#if activeClient?.has_secret}
                                <div class="flex items-center gap-1.5">
                                    {#if showSecretInSelector}
                                        <input
                                            type="text"
                                            bind:value={promptTargetSecret}
                                            placeholder="Tempel Client Secret"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                        />
                                    {:else}
                                        <input
                                            type="password"
                                            bind:value={promptTargetSecret}
                                            placeholder="Tempel Client Secret"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                        />
                                    {/if}
                                    <button
                                        on:click={saveManualSecret}
                                        class="p-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 cursor-pointer flex-shrink-0"
                                        title="Simpan secret ke memori browser"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                    </button>
                                    {#if knownSecrets[promptTargetClientId]}
                                        <button
                                            on:click={clearManualSecret}
                                            class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer flex-shrink-0"
                                            title="Hapus secret dari browser"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    {/if}
                                </div>
                            {:else}
                                <div class="py-1.5 px-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[11px] font-medium truncate">
                                    ⚡ PKCE Flow (Tanpa Secret)
                                </div>
                            {/if}
                        </div>

                        <!-- Redirect URI -->
                        <div class="space-y-1">
                            <span class="font-semibold text-[var(--text-2)] block">Redirect URI:</span>
                            {#if activeClient && activeClient.allowed_redirect_uris && activeClient.allowed_redirect_uris.length > 1}
                                <select
                                    bind:value={promptRedirectUri}
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                >
                                    {#each activeClient.allowed_redirect_uris as uri}
                                        <option value={uri}>{uri}</option>
                                    {/each}
                                </select>
                            {:else}
                                <input
                                    type="text"
                                    bind:value={promptRedirectUri}
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                                />
                            {/if}
                        </div>

                        <!-- Scope -->
                        <div class="space-y-1">
                            <span class="font-semibold text-[var(--text-2)] block">Scope Akses:</span>
                            <input
                                type="text"
                                bind:value={promptScope}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-1.5 px-2.5 text-[var(--text)] font-mono text-xs focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 class="text-base font-bold text-[var(--text)]">Contoh Kode Integrasi Multi-Bahasa</h3>
                            <p class="text-xs text-[var(--text-3)] mt-0.5">Kode di bawah otomatis disesuaikan dengan kredensial aplikasi yang dipilih.</p>
                        </div>

                        <!-- Language Selector Tabs -->
                        <div class="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] overflow-x-auto">
                            <button
                                on:click={() => activeLang = 'nodejs'}
                                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeLang === 'nodejs' ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                            >
                                Node.js
                            </button>
                            <button
                                on:click={() => activeLang = 'python'}
                                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeLang === 'python' ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                            >
                                Python
                            </button>
                            <button
                                on:click={() => activeLang = 'php'}
                                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeLang === 'php' ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                            >
                                PHP
                            </button>
                            <button
                                on:click={() => activeLang = 'flutter'}
                                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeLang === 'flutter' ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                            >
                                Flutter (PKCE)
                            </button>
                            <button
                                on:click={() => activeLang = 'react'}
                                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeLang === 'react' ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                            >
                                React / SPA
                            </button>
                            <button
                                on:click={() => activeLang = 'curl'}
                                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer {activeLang === 'curl' ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--text-2)] hover:bg-[var(--surface-3)]'}"
                            >
                                cURL CLI
                            </button>
                        </div>
                    </div>

                    <!-- Code Snippet Display -->
                    <div class="relative">
                        {#if activeLang === 'nodejs'}
                            <div class="relative group">
                                <button
                                    on:click={() => copyToClipboard(nodeJsSnippet, 'Snippet Node.js tersalin!')}
                                    class="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-md z-10 cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    <span>Salin Kode</span>
                                </button>
                                <pre class="p-4 rounded-2xl bg-[#090d16] text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">{nodeJsSnippet}</pre>
                            </div>
                        {:else if activeLang === 'python'}
                            <div class="relative group">
                                <button
                                    on:click={() => copyToClipboard(pythonSnippet, 'Snippet Python tersalin!')}
                                    class="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-md z-10 cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    <span>Salin Kode</span>
                                </button>
                                <pre class="p-4 rounded-2xl bg-[#090d16] text-blue-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">{pythonSnippet}</pre>
                            </div>
                        {:else if activeLang === 'php'}
                            <div class="relative group">
                                <button
                                    on:click={() => copyToClipboard(phpSnippet, 'Snippet PHP tersalin!')}
                                    class="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-md z-10 cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    <span>Salin Kode</span>
                                </button>
                                <pre class="p-4 rounded-2xl bg-[#090d16] text-purple-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">{phpSnippet}</pre>
                            </div>
                        {:else if activeLang === 'flutter'}
                            <div class="relative group">
                                <button
                                    on:click={() => copyToClipboard(flutterSnippet, 'Snippet Flutter tersalin!')}
                                    class="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-md z-10 cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    <span>Salin Kode</span>
                                </button>
                                <pre class="p-4 rounded-2xl bg-[#090d16] text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">{flutterSnippet}</pre>
                            </div>
                        {:else if activeLang === 'react'}
                            <div class="relative group">
                                <button
                                    on:click={() => copyToClipboard(reactSnippet, 'Snippet React tersalin!')}
                                    class="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-md z-10 cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    <span>Salin Kode</span>
                                </button>
                                <pre class="p-4 rounded-2xl bg-[#090d16] text-teal-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">{reactSnippet}</pre>
                            </div>
                        {:else if activeLang === 'curl'}
                            <div class="relative group">
                                <button
                                    on:click={() => copyToClipboard(curlSnippet, 'Snippet cURL tersalin!')}
                                    class="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-md z-10 cursor-pointer flex items-center gap-1.5"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    <span>Salin Kode</span>
                                </button>
                                <pre class="p-4 rounded-2xl bg-[#090d16] text-amber-300 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">{curlSnippet}</pre>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}

        <!-- ============================================================== -->
        <!-- TAB 4: PKCE GENERATOR & LIVE SIMULATOR                        -->
        <!-- ============================================================== -->
        {#if activeTab === 'pkce-tool'}
            <div class="space-y-5">
                <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-5">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h3 class="text-base font-bold text-[var(--text)]">PKCE Live Generator & Debugger</h3>
                            <p class="text-xs text-[var(--text-3)] mt-0.5">Generate pasangan Code Verifier dan Code Challenge (S256) untuk menguji aplikasi desktop/mobile.</p>
                        </div>
                        <button
                            on:click={generateNewPkcePair}
                            class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5 border-0"
                        >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Acak PKCE Baru</span>
                        </button>
                    </div>

                    <!-- Configuration Fields -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div class="space-y-1">
                            <label for="pkce-target-client" class="block font-semibold text-[var(--text-2)]">Target Client ID:</label>
                            <select
                                id="pkce-target-client"
                                bind:value={pkceClientId}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:outline-none"
                            >
                                {#each clients as c}
                                    <option value={c.client_id}>{c.name} ({c.client_id})</option>
                                {/each}
                                {#if clients.length === 0}
                                    <option value="YOUR_CLIENT_ID">Contoh Client ID</option>
                                {/if}
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label for="pkce-redirect-uri" class="block font-semibold text-[var(--text-2)]">Redirect URI:</label>
                            <input
                                id="pkce-redirect-uri"
                                type="text"
                                bind:value={pkceRedirectUri}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:outline-none"
                            />
                        </div>

                        <div class="space-y-1">
                            <label for="pkce-scope" class="block font-semibold text-[var(--text-2)]">Scope:</label>
                            <input
                                id="pkce-scope"
                                type="text"
                                bind:value={pkceScope}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:outline-none"
                            />
                        </div>

                        <div class="space-y-1">
                            <label for="pkce-state" class="block font-semibold text-[var(--text-2)]">State (CSRF):</label>
                            <input
                                id="pkce-state"
                                type="text"
                                bind:value={pkceState}
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:outline-none"
                            />
                        </div>
                    </div>

                    <!-- Live PKCE Cryptographic Values -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                        <div class="space-y-1.5">
                            <label for="pkce-live-verifier" class="block font-semibold text-[var(--text-2)]">Code Verifier (Rahasia Klien - Random Bytes):</label>
                            <div class="flex items-center gap-2">
                                <input
                                    id="pkce-live-verifier"
                                    type="text"
                                    readonly
                                    value={liveVerifier}
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs select-all focus:outline-none"
                                />
                                <button
                                    on:click={() => copyToClipboard(liveVerifier, 'Code Verifier tersalin!')}
                                    class="p-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] cursor-pointer flex-shrink-0"
                                    title="Salin Verifier"
                                >
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                </button>
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <label for="pkce-live-challenge" class="block font-semibold text-[var(--text-2)]">Code Challenge (Base64URL SHA-256 S256):</label>
                            <div class="flex items-center gap-2">
                                <input
                                    id="pkce-live-challenge"
                                    type="text"
                                    readonly
                                    value={liveChallenge}
                                    class="w-full bg-[var(--surface-2)] border border-blue-500/30 text-blue-500 rounded-xl py-2 px-3 font-mono text-xs select-all focus:outline-none"
                                />
                                <button
                                    on:click={() => copyToClipboard(liveChallenge, 'Code Challenge tersalin!')}
                                    class="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 cursor-pointer flex-shrink-0"
                                    title="Salin Challenge"
                                >
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Step 1: Test Authorize URL Builder -->
                    <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3 text-xs">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-[var(--text)] block">Langkah 1: Live Generated Authorize URL</span>
                            <span class="text-[11px] text-[var(--text-3)]">Klik untuk membuka layar otorisasi SSO</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <input
                                type="text"
                                readonly
                                value={liveAuthUrl}
                                class="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs select-all focus:outline-none"
                            />
                            <button
                                on:click={() => copyToClipboard(liveAuthUrl, 'URL Otorisasi tersalin!')}
                                class="px-3 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] font-semibold flex-shrink-0 cursor-pointer"
                            >
                                Salin
                            </button>
                            <a
                                href={liveAuthUrl}
                                target="_blank"
                                class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex-shrink-0 cursor-pointer no-underline flex items-center gap-1.5"
                            >
                                <span>Buka Uji SSO</span>
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    </div>

                    <!-- Step 2: Live Token Exchange Simulator -->
                    <div class="p-5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-4 text-xs">
                        <div>
                            <h4 class="font-bold text-[var(--text)]">Langkah 2: Simulator Penukaran Code ke Token (Live Token Exchange)</h4>
                            <p class="text-[11px] text-[var(--text-3)] mt-0.5">
                                Setelah Anda login di Langkah 1 dan diarahkan ke callback URI, salin parameter <code>?code=...</code> dari URL dan tempel di bawah untuk menguji respon token.
                            </p>
                        </div>

                        <div class="flex flex-col sm:flex-row items-center gap-2.5">
                            <input
                                type="text"
                                bind:value={simCode}
                                placeholder="Tempel kode otorisasi di sini (contoh: zqv_code_9a8b7c6d...)"
                                class="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:outline-none"
                            />
                            <button
                                on:click={handleSimulateTokenExchange}
                                disabled={simLoading}
                                class="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer shadow-sm disabled:opacity-60 border-0"
                            >
                                {#if simLoading}
                                    <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                                {/if}
                                <span>Tukar Token Sekarang</span>
                            </button>
                        </div>

                        {#if simError}
                            <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 font-medium text-xs">
                                ❌ {simError}
                            </div>
                        {/if}

                        {#if simResult}
                            <div class="p-4 rounded-xl bg-[#090d16] border border-slate-800 space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-emerald-400">✅ Respon Token Berhasil (200 OK):</span>
                                    <button on:click={() => copyToClipboard(JSON.stringify(simResult, null, 2), 'JSON Token tersalin!')} class="text-[11px] text-slate-400 hover:text-white cursor-pointer">Salin JSON</button>
                                </div>
                                <pre class="font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed">{JSON.stringify(simResult, null, 2)}</pre>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}

        <!-- ============================================================== -->
        <!-- TAB 5: DAFTAR ERROR RFC 6749 & 7636                            -->
        <!-- ============================================================== -->
        {#if activeTab === 'errors'}
            <div class="space-y-4">
                <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div>
                        <h3 class="text-base font-bold text-[var(--text)]">Daftar Kode Kesalahan Standar (RFC 6749 & RFC 7636)</h3>
                        <p class="text-xs text-[var(--text-3)] mt-0.5">Referensi kode error standar OAuth 2.0 yang dikembalikan oleh Authorization Server Ziqva.</p>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="border-b border-[var(--border)] text-[var(--text-3)]">
                                    <th class="py-2.5 pr-4 font-semibold">Error Code</th>
                                    <th class="py-2.5 px-4 font-semibold">HTTP Status</th>
                                    <th class="py-2.5 pl-4 font-semibold">Deskripsi & Solusi</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-[var(--border)]">
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">invalid_request</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">400 Bad Request</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Parameter wajib tidak lengkap, format URI tidak valid, atau parameter ganda.</td>
                                </tr>
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">unauthorized_client</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">401 / 403</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Aplikasi tidak aktif (dinonaktifkan oleh admin) atau tidak memiliki izin grant_type tersebut.</td>
                                </tr>
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">access_denied</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">302 Redirect</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Pengguna menolak memberikan izin pada layar persetujuan (Consent Screen).</td>
                                </tr>
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">unsupported_response_type</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">400 Bad Request</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Nilai <code>response_type</code> selain <code class="bg-[var(--surface-2)] px-1 rounded">code</code> tidak didukung.</td>
                                </tr>
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">invalid_scope</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">400 Bad Request</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Scope yang diminta melebihi allowed scopes yang terdaftar pada aplikasi klien.</td>
                                </tr>
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">invalid_grant</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">400 Bad Request</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Authorization code atau refresh token sudah kedaluwarsa, telah digunakan, atau PKCE verifier tidak cocok.</td>
                                </tr>
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">invalid_client</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">401 Unauthorized</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Client ID tidak ditemukan atau Client Secret yang dikirimkan salah.</td>
                                </tr>
                                <tr>
                                    <td class="py-3 pr-4 font-mono font-bold text-rose-500">server_error</td>
                                    <td class="py-3 px-4 font-mono text-[var(--text-3)]">500 Internal Server Error</td>
                                    <td class="py-3 pl-4 text-[var(--text-2)] leading-relaxed">Terjadi kegagalan internal pada server basis data atau sistem enkripsi.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        {/if}

    </main>

    <!-- ============================================================== -->
    <!-- MODAL CREATE CLIENT                                            -->
    <!-- ============================================================== -->
    {#if showCreateModal}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div class="w-full max-w-xl rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
                    <div>
                        <h3 class="text-base sm:text-lg font-bold text-[var(--text)]">Daftarkan Aplikasi OAuth Baru</h3>
                        <p class="text-xs text-[var(--text-3)] mt-0.5">Buat Client ID & integrasikan SSO akun Ziqva</p>
                    </div>
                    <button on:click={() => showCreateModal = false} class="text-[var(--text-3)] hover:text-[var(--text)] text-xl font-bold cursor-pointer">&times;</button>
                </div>

                {#if formError}
                    <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium">
                        {formError}
                    </div>
                {/if}

                <div class="space-y-4 text-xs">
                    <div>
                        <label for="create-app-name" class="block font-semibold text-[var(--text-2)] mb-1">Nama Aplikasi *</label>
                        <input
                            id="create-app-name"
                            type="text"
                            bind:value={formName}
                            placeholder="Contoh: Ziqva Desktop Tool / Web CRM"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label for="create-app-desc" class="block font-semibold text-[var(--text-2)] mb-1">Deskripsi Aplikasi</label>
                        <input
                            id="create-app-desc"
                            type="text"
                            bind:value={formDescription}
                            placeholder="Aplikasi otomasi Ziqva untuk pengguna internal"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label for="create-app-icon" class="block font-semibold text-[var(--text-2)] mb-1">Icon URL (Opsional)</label>
                        <input
                            id="create-app-icon"
                            type="url"
                            bind:value={formIconUrl}
                            placeholder="https://domain.com/icon.png"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label for="create-app-uris" class="block font-semibold text-[var(--text-2)] mb-1">Allowed Redirect URIs * (Satu per baris)</label>
                        <textarea
                            id="create-app-uris"
                            bind:value={formRedirectUris}
                            rows="3"
                            placeholder="https://app.example.com/oauth/callback&#10;http://localhost:3000/callback"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:border-blue-500 focus:outline-none leading-relaxed"
                        ></textarea>
                        <span class="text-[10px] text-[var(--text-3)] mt-1 block">URL yang diizinkan untuk menerima kode otorisasi setelah login sukses.</span>
                    </div>

                    <div>
                        <label for="create-app-origins" class="block font-semibold text-[var(--text-2)] mb-1">Allowed CORS Origins (Satu per baris)</label>
                        <textarea
                            id="create-app-origins"
                            bind:value={formOrigins}
                            rows="2"
                            placeholder="https://app.example.com&#10;http://localhost:3000"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:border-blue-500 focus:outline-none leading-relaxed"
                        ></textarea>
                    </div>

                    <div>
                        <label for="create-app-scopes" class="block font-semibold text-[var(--text-2)] mb-1">Allowed Scopes</label>
                        <input
                            id="create-app-scopes"
                            type="text"
                            bind:value={formScopes}
                            placeholder="profile email whatsapp licenses"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div class="space-y-2.5 pt-3 border-t border-[var(--border)]">
                        <label class="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" bind:checked={formIsTrusted} class="rounded text-blue-600 focus:ring-0 mt-0.5" />
                            <div>
                                <span class="text-xs text-[var(--text)] font-semibold block">Tandai sebagai Aplikasi Trusted / First-Party</span>
                                <span class="text-[11px] text-[var(--text-3)]">Aplikasi resmi Ziqva dapat melewati layar persetujuan (Bypass Consent) jika user sudah login.</span>
                            </div>
                        </label>
                        <label class="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" bind:checked={formGenerateSecret} class="rounded text-blue-600 focus:ring-0 mt-0.5" />
                            <div>
                                <span class="text-xs text-[var(--text)] font-semibold block">Generate Client Secret (Confidential Client)</span>
                                <span class="text-[11px] text-[var(--text-3)]">Centang jika aplikasi memiliki backend server. Nonaktifkan jika aplikasi berupa SPA/Mobile publik murni berbasis PKCE.</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="flex justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
                    <button
                        on:click={() => showCreateModal = false}
                        class="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-2)] text-xs font-semibold cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        on:click={handleCreateClient}
                        disabled={formSubmitting}
                        class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer flex items-center gap-2 border-0"
                    >
                        {#if formSubmitting}
                            <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                        {/if}
                        <span>Simpan & Daftarkan</span>
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- ============================================================== -->
    <!-- MODAL EDIT CLIENT                                              -->
    <!-- ============================================================== -->
    {#if showEditModal && selectedClient}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div class="w-full max-w-xl rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
                    <div>
                        <h3 class="text-base sm:text-lg font-bold text-[var(--text)]">Edit Aplikasi: {selectedClient.name}</h3>
                        <p class="text-xs text-[var(--text-3)] mt-0.5 font-mono">{selectedClient.client_id}</p>
                    </div>
                    <button on:click={() => showEditModal = false} class="text-[var(--text-3)] hover:text-[var(--text)] text-xl font-bold cursor-pointer">&times;</button>
                </div>

                {#if formError}
                    <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-medium">
                        {formError}
                    </div>
                {/if}

                <div class="space-y-4 text-xs">
                    <div>
                        <label for="edit-app-name" class="block font-semibold text-[var(--text-2)] mb-1">Nama Aplikasi *</label>
                        <input
                            id="edit-app-name"
                            type="text"
                            bind:value={formName}
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label for="edit-app-desc" class="block font-semibold text-[var(--text-2)] mb-1">Deskripsi</label>
                        <input
                            id="edit-app-desc"
                            type="text"
                            bind:value={formDescription}
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label for="edit-app-icon" class="block font-semibold text-[var(--text-2)] mb-1">Icon URL</label>
                        <input
                            id="edit-app-icon"
                            type="url"
                            bind:value={formIconUrl}
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label for="edit-app-uris" class="block font-semibold text-[var(--text-2)] mb-1">Allowed Redirect URIs * (Satu per baris)</label>
                        <textarea
                            id="edit-app-uris"
                            bind:value={formRedirectUris}
                            rows="3"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:border-blue-500 focus:outline-none leading-relaxed"
                        ></textarea>
                    </div>

                    <div>
                        <label for="edit-app-origins" class="block font-semibold text-[var(--text-2)] mb-1">Allowed CORS Origins (Satu per baris)</label>
                        <textarea
                            id="edit-app-origins"
                            bind:value={formOrigins}
                            rows="2"
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2 px-3 text-[var(--text)] font-mono text-xs focus:border-blue-500 focus:outline-none leading-relaxed"
                        ></textarea>
                    </div>

                    <div>
                        <label for="edit-app-scopes" class="block font-semibold text-[var(--text-2)] mb-1">Allowed Scopes</label>
                        <input
                            id="edit-app-scopes"
                            type="text"
                            bind:value={formScopes}
                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 px-3.5 text-[var(--text)] font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div class="space-y-2.5 pt-3 border-t border-[var(--border)]">
                        <label class="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" bind:checked={formIsTrusted} class="rounded text-blue-600 focus:ring-0 mt-0.5" />
                            <div>
                                <span class="text-xs text-[var(--text)] font-semibold block">Tandai sebagai Aplikasi Trusted / First-Party</span>
                                <span class="text-[11px] text-[var(--text-3)]">Bypass layar izin jika user sudah login</span>
                            </div>
                        </label>
                        <label class="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" bind:checked={formIsActive} class="rounded text-blue-600 focus:ring-0 mt-0.5" />
                            <div>
                                <span class="text-xs text-[var(--text)] font-semibold block">Status Aktif</span>
                                <span class="text-[11px] text-[var(--text-3)]">Nonaktifkan untuk menolak semua request otorisasi dari aplikasi ini</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="flex justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
                    <button
                        on:click={() => showEditModal = false}
                        class="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-2)] text-xs font-semibold cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        on:click={handleUpdateClient}
                        disabled={formSubmitting}
                        class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer flex items-center gap-2 border-0"
                    >
                        {#if formSubmitting}
                            <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                        {/if}
                        <span>Simpan Perubahan</span>
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- ============================================================== -->
    <!-- MODAL REVEAL NEW SECRET                                        -->
    <!-- ============================================================== -->
    {#if showSecretModal && newlyCreatedSecret}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div class="w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-purple-500/40 p-6 sm:p-7 shadow-2xl space-y-5">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-[var(--text)]">Client Secret Baru Diterbitkan</h3>
                        <p class="text-xs text-[var(--text-3)]">Aplikasi: <strong class="text-purple-600 dark:text-purple-400">{secretClientName}</strong></p>
                    </div>
                </div>

                <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
                    ⚠️ <strong>PERHATIAN KEAMANAN:</strong> Simpan nilai Client Secret ini sekarang di tempat yang aman. Demi keamanan, nilai secret ini di-hash di database dan tidak akan ditampilkan kembali.
                </div>

                <div class="space-y-1.5">
                    <label for="secret-plaintext-display" class="block text-xs font-semibold text-[var(--text-3)]">Client Secret (Plaintext):</label>
                    <div class="flex items-center gap-2">
                        <input
                            id="secret-plaintext-display"
                            type="text"
                            readonly
                            value={newlyCreatedSecret}
                            class="w-full bg-[var(--surface-2)] border border-purple-500/40 text-purple-600 dark:text-purple-300 font-mono text-xs rounded-xl py-2.5 px-3.5 select-all focus:outline-none"
                        />
                        <button
                            on:click={() => copyToClipboard(newlyCreatedSecret || '', 'Client Secret tersalin!')}
                            class="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-md border-0"
                        >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            <span>Salin</span>
                        </button>
                    </div>
                </div>

                <div class="pt-3 border-t border-[var(--border)] flex justify-end">
                    <button
                        on:click={() => { showSecretModal = false; newlyCreatedSecret = null; }}
                        class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-md border-0"
                    >
                        Saya Sudah Menyimpan Secret Ini
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- ============================================================== -->
    <!-- MODAL DELETE CONFIRMATION                                      -->
    <!-- ============================================================== -->
    {#if showDeleteModal && selectedClient}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div class="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-rose-500/30 p-6 shadow-2xl space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-[var(--text)]">Hapus Aplikasi OAuth</h3>
                        <p class="text-xs text-rose-500">{selectedClient.name}</p>
                    </div>
                </div>

                <p class="text-xs text-[var(--text-3)] leading-relaxed">
                    Apakah Anda yakin ingin menghapus aplikasi ini? Seluruh token sesi aktif pengguna yang terhubung akan <strong>langsung dicabut seketika</strong>.
                </p>

                <div class="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                    <button
                        on:click={() => showDeleteModal = false}
                        class="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-2)] text-xs font-semibold cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        on:click={handleDeleteClient}
                        disabled={formSubmitting}
                        class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer shadow-md border-0"
                    >
                        {formSubmitting ? 'Menghapus...' : 'Ya, Hapus Aplikasi'}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</AdminLayout>
