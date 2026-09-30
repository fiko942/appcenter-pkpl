<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomSelect from '../components/CustomSelect.svelte';
    import { auth } from '../stores/auth';

    interface DownloadLogEntry {
        downloaded_at: number;
        downloaded_by: string;
        ip: string;
        browser: string;
        user_agent: string;
    }

    interface BackupItem {
        id: number;
        filename: string;
        file_size: number;
        checksum_sha256: string | null;
        table_count: number;
        record_count: number;
        status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
        progress: number;
        current_step: string | null;
        error_message: string | null;
        created_by: string;
        created_at: number;
        completed_at: number | null;
        download_count: number;
        last_download_at: number | null;
        last_download_by: string | null;
        last_download_ip: string | null;
        last_download_browser: string | null;
        download_history: DownloadLogEntry[];
    }

    let loading: boolean = true;
    let backups: BackupItem[] = [];
    let activeBackup: BackupItem | null = null;
    let creatingBackup: boolean = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Modals
    let auditModalOpen: boolean = false;
    let selectedBackupAudit: BackupItem | null = null;
    let deleteModalOpen: boolean = false;
    let backupToDelete: BackupItem | null = null;
    let deleting: boolean = false;

    // GoQRIS Payment Gateway Configuration State
    let goqrisConfig = {
        api_key: '',
        has_api_key: false,
        project_name: '',
        callback_url: '',
        webhook_secret: '',
        has_webhook_secret: false,
        is_active: true,
        expiry_minutes: 1440,
        admin_fee: 0,
        admin_fee_percent: 0
    };
    let loadingGoqris = true;
    let savingGoqris = false;

    // Unit expiry options for CustomSelect
    const expiryUnitOptions = [
        { value: 'hours', label: 'Jam' },
        { value: 'minutes', label: 'Menit' }
    ];
    let expiryUnit: 'hours' | 'minutes' = 'hours';
    let expiryValue: number = 24;

    // Doc modal state
    let docModalOpen: boolean = false;

    // Formatted rupiah input handler
    function formatRupiahDisplay(val: number): string {
        if (!val || isNaN(val)) return '0';
        return Number(val).toLocaleString('id-ID');
    }

    function handleAdminFeeInput(e: Event) {
        const input = e.target as HTMLInputElement;
        const raw = input.value.replace(/[^0-9]/g, '');
        const num = raw ? parseInt(raw, 10) : 0;
        goqrisConfig.admin_fee = num;
        input.value = num ? num.toLocaleString('id-ID') : '0';
    }

    // Sync expiryValue and expiryUnit when goqrisConfig.expiry_minutes changes
    function syncExpiryFromMinutes(minutes: number) {
        if (!minutes || minutes <= 0) minutes = 1440;
        if (minutes % 60 === 0) {
            expiryUnit = 'hours';
            expiryValue = minutes / 60;
        } else {
            expiryUnit = 'minutes';
            expiryValue = minutes;
        }
    }

    function updateExpiryMinutes() {
        if (expiryUnit === 'hours') {
            goqrisConfig.expiry_minutes = Math.max(1, (expiryValue || 1) * 60);
        } else {
            goqrisConfig.expiry_minutes = Math.max(1, expiryValue || 1);
        }
    }

    async function loadGoqrisConfig() {
        loadingGoqris = true;
        try {
            const res = await fetch('/admin/api/settings/payment');
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                goqrisConfig = {
                    ...data.data,
                    api_key: data.data.api_key || '',
                    webhook_secret: data.data.webhook_secret || '',
                    callback_url: data.data.callback_url || ''
                };
                syncExpiryFromMinutes(goqrisConfig.expiry_minutes);
            }
        } catch (e) {
            console.error('Failed to load GoQRIS config:', e);
        } finally {
            loadingGoqris = false;
        }
    }

    async function saveGoqrisConfig() {
        savingGoqris = true;
        try {
            const res = await fetch('/admin/api/settings/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goqrisConfig)
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast('Pengaturan Payment Gateway GoQRIS berhasil disimpan', 'success');
                await loadGoqrisConfig();
            } else {
                showToast(data.message || 'Gagal menyimpan pengaturan', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Gagal menyimpan pengaturan', 'error');
        } finally {
            savingGoqris = false;
        }
    }

    // SMTP Configuration State
    let smtpConfig = {
        id: null as number | null,
        host: '',
        port: 587,
        secure: false,
        encryption: 'tls' as 'tls' | 'ssl' | 'none',
        username: '',
        password: '',
        has_password: false,
        from_email: '',
        from_name: 'AppCenter - Ziqva Labs',
        reply_to: '',
        is_active: true,
        require_auth: true
    };
    let showSmtpPassword = false;
    let loadingSmtp = true;
    let savingSmtp = false;
    let testingSmtp = false;
    let testEmailRecipient = '';
    let testResult: { success: boolean; message: string; details?: any } | null = null;

    const encryptionOptions = [
        { value: 'tls', label: 'STARTTLS / TLS (Port 587 - Rekomendasi)', description: 'Standar enkripsi modern yang aman' },
        { value: 'ssl', label: 'SSL / Direct TLS (Port 465)', description: 'Koneksi terenkripsi langsung sejak handshake awal' },
        { value: 'none', label: 'None / Plain (Port 25)', description: 'Tanpa enkripsi' }
    ];

    function applySmtpPreset(preset: 'gmail' | 'gmail_ssl' | 'outlook' | 'zoho' | 'cpanel') {
        if (preset === 'gmail') {
            smtpConfig.host = 'smtp.gmail.com';
            smtpConfig.port = 587;
            smtpConfig.encryption = 'tls';
            smtpConfig.secure = false;
            smtpConfig.require_auth = true;
            showToast('Preset Gmail (TLS 587) diterapkan. Masukkan App Password Google Anda.', 'success');
        } else if (preset === 'gmail_ssl') {
            smtpConfig.host = 'smtp.gmail.com';
            smtpConfig.port = 465;
            smtpConfig.encryption = 'ssl';
            smtpConfig.secure = true;
            smtpConfig.require_auth = true;
            showToast('Preset Gmail (SSL 465) diterapkan.', 'success');
        } else if (preset === 'outlook') {
            smtpConfig.host = 'smtp.office365.com';
            smtpConfig.port = 587;
            smtpConfig.encryption = 'tls';
            smtpConfig.secure = false;
            smtpConfig.require_auth = true;
            showToast('Preset Microsoft 365 / Outlook (587) diterapkan.', 'success');
        } else if (preset === 'zoho') {
            smtpConfig.host = 'smtppro.zoho.com';
            smtpConfig.port = 465;
            smtpConfig.encryption = 'ssl';
            smtpConfig.secure = true;
            smtpConfig.require_auth = true;
            showToast('Preset Zoho Mail (SSL 465) diterapkan.', 'success');
        } else if (preset === 'cpanel') {
            smtpConfig.port = 465;
            smtpConfig.encryption = 'ssl';
            smtpConfig.secure = true;
            smtpConfig.require_auth = true;
            if (!smtpConfig.host || smtpConfig.host.includes('gmail') || smtpConfig.host.includes('office365') || smtpConfig.host.includes('zoho')) {
                smtpConfig.host = 'mail.domainanda.com';
            }
            showToast('Preset cPanel / Custom Webmail (SSL 465) diterapkan.', 'success');
        }
    }

    async function loadSmtpConfig() {
        loadingSmtp = true;
        try {
            const res = await fetch('/admin/api/settings/smtp');
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                smtpConfig = {
                    ...data.data,
                    password: data.data.password || '',
                    reply_to: data.data.reply_to || ''
                };
            }
        } catch (e) {
            console.error('Failed to load SMTP config:', e);
        } finally {
            loadingSmtp = false;
        }
    }

    async function saveSmtpConfig() {
        if (!smtpConfig.host || !smtpConfig.host.trim()) {
            showToast('Host SMTP wajib diisi', 'error');
            return;
        }
        if (!smtpConfig.from_email || !smtpConfig.from_email.trim()) {
            showToast('Email pengirim (From Email) wajib diisi', 'error');
            return;
        }

        savingSmtp = true;
        try {
            const res = await fetch('/admin/api/settings/smtp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(smtpConfig)
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast('Pengaturan SMTP & Email berhasil disimpan', 'success');
                await loadSmtpConfig();
            } else {
                showToast(data.message || 'Gagal menyimpan pengaturan SMTP', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Gagal menyimpan pengaturan SMTP', 'error');
        } finally {
            savingSmtp = false;
        }
    }

    async function runTestSmtp() {
        if (!smtpConfig.host) {
            showToast('Mohon isi Host SMTP terlebih dahulu', 'error');
            return;
        }
        testingSmtp = true;
        testResult = null;
        try {
            const res = await fetch('/admin/api/settings/smtp/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...smtpConfig,
                    test_email: testEmailRecipient.trim() || undefined
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                testResult = { success: true, message: data.message, details: data.details };
                showToast(data.message, 'success');
            } else {
                testResult = { success: false, message: data.message || 'Koneksi SMTP gagal diverifikasi' };
                showToast(data.message || 'Uji coba SMTP gagal', 'error');
            }
        } catch (e: any) {
            testResult = { success: false, message: e.message || 'Terjadi kesalahan saat menguji SMTP' };
            showToast(e.message || 'Uji coba SMTP gagal', 'error');
        } finally {
            testingSmtp = false;
        }
    }

    // Toast notification
    let toastMessage: string = '';
    let toastType: 'success' | 'error' = 'success';
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    function showToast(msg: string, type: 'success' | 'error' = 'success') {
        toastMessage = msg;
        toastType = type;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastMessage = '';
        }, 4000);
    }

    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDate(epoch: number | null): string {
        if (!epoch) return '-';
        const d = new Date(epoch * 1000);
        return d.toLocaleString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    async function fetchBackups() {
        try {
            const res = await fetch('/admin/api/settings/backups', {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    backups = data.backups || [];
                    checkActiveProgress();
                }
            }
        } catch (e) {
            console.error('Failed to load backups:', e);
        } finally {
            loading = false;
        }
    }

    function checkActiveProgress() {
        const inProgress = backups.find(b => b.status === 'IN_PROGRESS' || b.status === 'PENDING');
        if (inProgress) {
            activeBackup = inProgress;
            startPolling(inProgress.id);
        } else {
            activeBackup = null;
            stopPolling();
        }
    }

    function startPolling(id: number) {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
            try {
                const res = await fetch(`/admin/api/settings/backup/status/${id}`, {
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.backup) {
                        const updated = data.backup;
                        // Update in backups list
                        const idx = backups.findIndex(b => b.id === id);
                        if (idx !== -1) {
                            backups[idx] = updated;
                            backups = [...backups];
                        }
                        activeBackup = updated;

                        if (updated.status === 'COMPLETED') {
                            stopPolling();
                            activeBackup = null;
                            showToast('Pencadangan database berhasil diselesaikan!', 'success');
                            fetchBackups();
                        } else if (updated.status === 'FAILED') {
                            stopPolling();
                            activeBackup = null;
                            showToast('Pencadangan database gagal: ' + (updated.error_message || 'Terjadi kesalahan'), 'error');
                            fetchBackups();
                        }
                    }
                }
            } catch (e) {
                console.error('Polling error:', e);
            }
        }, 1200);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    async function handleStartBackup() {
        if (creatingBackup || activeBackup) return;
        creatingBackup = true;

        try {
            const res = await fetch('/admin/api/settings/backup/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok && data.success && data.backup) {
                showToast('Proses pencadangan database telah dimulai.', 'success');
                backups = [data.backup, ...backups];
                activeBackup = data.backup;
                startPolling(data.backup.id);
            } else {
                showToast(data.error || 'Gagal memulai pencadangan database', 'error');
            }
        } catch (e) {
            showToast('Terjadi kesalahan saat memulai pencadangan', 'error');
        } finally {
            creatingBackup = false;
        }
    }

    function triggerDownload(b: BackupItem) {
        if (b.status !== 'COMPLETED') return;
        const downloadUrl = `/admin/api/settings/backup/download/${b.id}`;
        
        // Open download link
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = b.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Optimistically refresh audit logs after slight delay
        setTimeout(() => {
            fetchBackups();
        }, 1500);
    }

    function openAuditModal(b: BackupItem) {
        selectedBackupAudit = b;
        auditModalOpen = true;
    }

    function openDeleteModal(b: BackupItem) {
        backupToDelete = b;
        deleteModalOpen = true;
    }

    async function confirmDeleteBackup() {
        if (!backupToDelete) return;
        deleting = true;

        try {
            const res = await fetch(`/admin/api/settings/backup/delete/${backupToDelete.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Berkas cadangan berhasil dihapus', 'success');
                backups = backups.filter(b => b.id !== backupToDelete!.id);
                deleteModalOpen = false;
                backupToDelete = null;
            } else {
                showToast(data.error || 'Gagal menghapus berkas cadangan', 'error');
            }
        } catch (e) {
            showToast('Terjadi kesalahan saat menghapus cadangan', 'error');
        } finally {
            deleting = false;
        }
    }

    function copyToClipboard(text: string, label: string) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`${label} disalin ke clipboard!`, 'success');
        });
    }

    onMount(() => {
        fetchBackups();
        loadGoqrisConfig();
        loadSmtpConfig();
    });

    onDestroy(() => {
        stopPolling();
        if (toastTimer) clearTimeout(toastTimer);
    });

    $: adminName = $auth.user?.name || 'Admin';
    $: totalBackupsCount = backups.length;
    $: completedBackupsCount = backups.filter(b => b.status === 'COMPLETED').length;
    $: totalDownloadsCount = backups.reduce((acc, b) => acc + (b.download_count || 0), 0);
    $: totalStorageUsed = backups.reduce((acc, b) => acc + (b.file_size || 0), 0);

    let activeTab: 'database' | 'payment' | 'smtp' = 'database';
</script>

<svelte:head>
    <title>Pengaturan Sistem - Admin Appcenter</title>
</svelte:head>

<AdminLayout activePage="settings" eyebrow="Pengaturan Sistem" {adminName}>
    <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
            
            <!-- Toast Notification -->
            {#if toastMessage}
                <div class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md text-xs font-medium animate-in fade-in slide-in-from-bottom-5 {toastType === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'}">
                    {#if toastType === 'success'}
                        <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    {:else}
                        <svg class="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    {/if}
                    <span>{toastMessage}</span>
                </div>
            {/if}

            <!-- Tabs Navigation -->
            <div class="flex items-center gap-1 p-1 sm:p-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar touch-pan-x">
                <button
                    type="button"
                    on:click={() => activeTab = 'database'}
                    class="flex-shrink-0 justify-center px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap select-none
                    {activeTab === 'database' ? 'bg-[var(--surface)] text-blue-500 shadow-sm border border-[var(--border)]' : 'bg-transparent text-[var(--text-3)] hover:text-[var(--text)]'}"
                >
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                    <span class="whitespace-nowrap">Database Backup</span>
                </button>
                <button
                    type="button"
                    on:click={() => activeTab = 'payment'}
                    class="flex-shrink-0 justify-center px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap select-none
                    {activeTab === 'payment' ? 'bg-[var(--surface)] text-emerald-500 shadow-sm border border-[var(--border)]' : 'bg-transparent text-[var(--text-3)] hover:text-[var(--text)]'}"
                >
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                    <span class="whitespace-nowrap">Payment Gateway</span>
                </button>
                <button
                    type="button"
                    on:click={() => activeTab = 'smtp'}
                    class="flex-shrink-0 justify-center px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap select-none
                    {activeTab === 'smtp' ? 'bg-[var(--surface)] text-blue-500 shadow-sm border border-[var(--border)]' : 'bg-transparent text-[var(--text-3)] hover:text-[var(--text)]'}"
                >
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    <span class="whitespace-nowrap">SMTP & Email</span>
                </button>
            </div>

            {#if activeTab === 'payment'}
            <!-- Konfigurasi Payment Gateway (GoQRIS) -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl sm:text-2xl font-black text-[var(--text)] tracking-tight flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <span>Payment Gateway</span>
                    </h1>
                    <p class="text-xs text-[var(--text-3)] mt-1">
                        Pengaturan gerbang pembayaran GoQRIS, webhook, batas masa aktif QR, dan informasi biaya admin.
                    </p>
                </div>
            </div>

            <!-- Top Summary KPI Cards -->
            <div class="p-5 sm:p-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-sm space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-sm sm:text-base font-bold text-[var(--text)]">Konfigurasi Payment Gateway (GoQRIS)</h2>
                            <p class="text-xs text-[var(--text-3)] flex items-center gap-1.5 flex-wrap">
                                Kelola kredensial API, nama merchant project, batas masa aktif QR, dan status layanan
                                <button
                                    type="button"
                                    on:click={() => docModalOpen = true}
                                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors border-0 cursor-pointer"
                                    title="Cara mendapatkan API Key dan Project Name"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Lihat Panduan
                                </button>
                            </p>
                        </div>
                    </div>

                    <!-- Toggle Status Aktif / Nonaktif -->
                    <div class="flex items-center gap-3 bg-[var(--surface-2)] px-4 py-2 rounded-2xl border border-[var(--border)]">
                        <span class="text-xs font-bold {goqrisConfig.is_active ? 'text-emerald-500' : 'text-rose-500'}">
                            {goqrisConfig.is_active ? 'Gateway Aktif' : 'Gateway Nonaktif (Off)'}
                        </span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" bind:checked={goqrisConfig.is_active} class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>

                {#if loadingGoqris}
                    <div class="py-8 text-center text-xs text-[var(--text-3)]">Memuat pengaturan GoQRIS...</div>
                {:else}
                    <form on:submit|preventDefault={saveGoqrisConfig} class="space-y-4 text-xs">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- API Key -->
                            <div>
                                <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider">
                                    GoQRIS API Key <span class="text-rose-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    bind:value={goqrisConfig.api_key}
                                    placeholder={goqrisConfig.has_api_key ? '•••••••••••••••• (Tersimpan)' : 'Masukkan API Key GoQRIS'}
                                    class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono"
                                />
                                <p class="text-[10px] text-[var(--text-3)] mt-1">Disimpan aman di server dan tidak pernah terekspos ke frontend publik.</p>
                            </div>

                            <!-- Nama Project Merchant -->
                            <div>
                                <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider">
                                    Nama Project Merchant <span class="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    bind:value={goqrisConfig.project_name}
                                    placeholder="Contoh: Ziqva Labs"
                                    class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500"
                                />
                                <p class="text-[10px] text-[var(--text-3)] mt-1">Harus persis sama dengan nama Project yang terdaftar di akun GoQRIS Anda.</p>
                            </div>

                            <!-- Expiry Minutes -->
                            <div>
                                <label class="flex items-center justify-between font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider">
                                    <span>Masa Aktif Tagihan / QR</span>
                                </label>
                                <div class="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        bind:value={expiryValue}
                                        on:input={updateExpiryMinutes}
                                        min="1"
                                        class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono text-xs"
                                    />
                                    <div class="w-36 flex-shrink-0">
                                        <CustomSelect
                                            options={expiryUnitOptions}
                                            bind:value={expiryUnit}
                                            fullWidth={true}
                                            on:change={updateExpiryMinutes}
                                        />
                                    </div>
                                </div>
                                <p class="text-[10px] text-[var(--text-3)] mt-1">Batas waktu QRIS kedaluwarsa (Disimpan sebagai {goqrisConfig.expiry_minutes} Menit).</p>
                            </div>

                            <!-- Biaya Admin Flat -->
                            <div>
                                <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider">
                                    Biaya Admin Tambahan (Rp Flat)
                                </label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span class="text-[var(--text-3)] font-bold font-mono">Rp</span>
                                    </div>
                                    <input
                                        type="text"
                                        inputmode="numeric"
                                        value={formatRupiahDisplay(goqrisConfig.admin_fee)}
                                        on:input={handleAdminFeeInput}
                                        placeholder="0"
                                        class="w-full pl-12 pr-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                                <p class="text-[10px] text-[var(--text-3)] mt-1">Biaya admin nominal tetap yang dibebankan langsung kepada pembeli.</p>
                            </div>

                            <!-- Webhook Secret (HMAC-SHA256) -->
                            <div>
                                <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider">
                                    Webhook Secret Key (HMAC Verification)
                                </label>
                                <input
                                    type="password"
                                    bind:value={goqrisConfig.webhook_secret}
                                    placeholder={goqrisConfig.has_webhook_secret ? '•••••••••••••••• (Tersimpan)' : 'Opsional: Masukkan Secret Webhook'}
                                    class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono"
                                />
                                <p class="text-[10px] text-[var(--text-3)] mt-1">Digunakan untuk memvalidasi header signature X-GoQRIS-Signature secara aman.</p>
                            </div>

                            <!-- Callback URL / Webhook Endpoint Custom -->
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <label class="font-bold text-[var(--text-2)] uppercase tracking-wider">
                                        Custom Callback URL
                                    </label>
                                    <button
                                        type="button"
                                        on:click={() => goqrisConfig.callback_url = `${window.location.origin}/payment/notification`}
                                        class="text-[10px] text-blue-500 hover:underline font-bold cursor-pointer border-0 bg-transparent p-0"
                                    >
                                        Gunakan Domain Aktif
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    bind:value={goqrisConfig.callback_url}
                                    placeholder={`${typeof window !== 'undefined' ? window.location.origin : ''}/payment/notification`}
                                    class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono"
                                />
                                <p class="text-[10px] text-[var(--text-3)] mt-1">URL tujuan callback pembayaran GoQRIS (Otomatis menyesuaikan domain/localhost jika dikosongkan).</p>
                            </div>
                        </div>

                        <!-- Info Box URL Callback Aktif Otomatis -->
                        <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2 mt-4">
                            <div class="flex items-center justify-between flex-wrap gap-2">
                                <div class="font-bold text-[var(--text)] flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>URL Callback / Webhook Aktif Sistem Ini:</span>
                                </div>
                                <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono font-bold">
                                    {window.location.hostname.includes('localhost') ? 'MODE DEVELOPMENT (LOCALHOST)' : 'MODE PRODUCTION'}
                                </span>
                            </div>
                            <div class="flex items-center gap-2 bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                                <code class="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex-1 truncate select-all">
                                    {goqrisConfig.callback_url || `${typeof window !== 'undefined' ? window.location.origin : ''}/payment/notification`}
                                </code>
                                <button
                                    type="button"
                                    on:click={() => copyToClipboard(goqrisConfig.callback_url || `${typeof window !== 'undefined' ? window.location.origin : ''}/payment/notification`, 'Callback URL')}
                                    class="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors border-0 cursor-pointer flex items-center gap-1"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                    Salin Callback URL
                                </button>
                            </div>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">
                                Daftarkan URL di atas pada dashboard GoQRIS di menu <strong>Pengaturan &rarr; Callback Pembayaran</strong> agar notifikasi lunas diproses secara otomatis oleh server.
                            </p>
                        </div>

                        {#if !goqrisConfig.is_active}
                            <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2 mt-4">
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>Saat status dinonaktifkan, tombol checkout dan pesanan baru tidak dapat diproses oleh pengguna.</span>
                            </div>
                        {/if}

                        <div class="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={savingGoqris}
                                class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                            >
                                {#if savingGoqris}
                                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Menyimpan...</span>
                                {:else}
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Simpan Pengaturan GoQRIS</span>
                                {/if}
                            </button>
                        </div>
                    </form>
                {/if}
            </div>
            {/if}

            {#if activeTab === 'smtp'}
            <!-- Konfigurasi SMTP & Layanan Email -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl sm:text-2xl font-black text-[var(--text)] tracking-tight flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span>SMTP & Layanan Email</span>
                    </h1>
                    <p class="text-xs text-[var(--text-3)] mt-1">
                        Konfigurasi mail server untuk pengiriman kode OTP pendaftaran member, reset password, dan notifikasi keamanan akun.
                    </p>
                </div>
            </div>

            <!-- Main SMTP Card -->
            <div class="p-5 sm:p-6 bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-sm space-y-6">
                <!-- Card Header with Title and Toggle Status -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-sm sm:text-base font-bold text-[var(--text)]">Konfigurasi Mail Server (SMTP)</h2>
                            <p class="text-xs text-[var(--text-3)]">
                                Kelola kredensial server email, protokol enkripsi, dan identitas pengirim resmi
                            </p>
                        </div>
                    </div>

                    <!-- Toggle Status Switch -->
                    <div class="flex items-center gap-3 bg-[var(--surface-2)] px-4 py-2 rounded-2xl border border-[var(--border)] flex-shrink-0">
                        <span class="text-xs font-bold {smtpConfig.is_active ? 'text-emerald-500' : 'text-rose-500'}">
                            {smtpConfig.is_active ? 'Layanan Aktif' : 'Layanan Nonaktif (Off)'}
                        </span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" bind:checked={smtpConfig.is_active} class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>

                {#if loadingSmtp}
                    <div class="py-12 text-center space-y-3">
                        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p class="text-xs text-[var(--text-3)]">Memuat konfigurasi SMTP...</p>
                    </div>
                {:else}
                    <!-- Provider Presets -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                        <div class="text-xs font-semibold text-[var(--text-2)] flex items-center gap-2">
                            <svg class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Template Preset:</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                on:click={() => applySmtpPreset('gmail')}
                                class="px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border)] hover:border-blue-500/30 text-[11px] font-semibold text-[var(--text-2)] transition-all cursor-pointer"
                            >
                                Gmail (TLS 587)
                            </button>
                            <button
                                type="button"
                                on:click={() => applySmtpPreset('gmail_ssl')}
                                class="px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border)] hover:border-blue-500/30 text-[11px] font-semibold text-[var(--text-2)] transition-all cursor-pointer"
                            >
                                Gmail (SSL 465)
                            </button>
                            <button
                                type="button"
                                on:click={() => applySmtpPreset('outlook')}
                                class="px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border)] hover:border-blue-500/30 text-[11px] font-semibold text-[var(--text-2)] transition-all cursor-pointer"
                            >
                                Outlook 365
                            </button>
                            <button
                                type="button"
                                on:click={() => applySmtpPreset('zoho')}
                                class="px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border)] hover:border-blue-500/30 text-[11px] font-semibold text-[var(--text-2)] transition-all cursor-pointer"
                            >
                                Zoho Mail
                            </button>
                            <button
                                type="button"
                                on:click={() => applySmtpPreset('cpanel')}
                                class="px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border)] hover:border-blue-500/30 text-[11px] font-semibold text-[var(--text-2)] transition-all cursor-pointer"
                            >
                                cPanel / Webmail
                            </button>
                        </div>
                    </div>

                    <form on:submit|preventDefault={saveSmtpConfig} class="space-y-6">
                        <!-- Form Fields Grid -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs">
                            
                            <!-- Column 1: Server & Credentials -->
                            <div class="space-y-4">
                                <div class="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-[var(--border)]">
                                    <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                                    </svg>
                                    <span>Kredensial Server SMTP</span>
                                </div>

                                <!-- Host SMTP -->
                                <div>
                                    <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="smtp_host">
                                        Host SMTP <span class="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="smtp_host"
                                        type="text"
                                        bind:value={smtpConfig.host}
                                        placeholder="Contoh: smtp.gmail.com atau mail.domain.com"
                                        class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono text-xs"
                                        required
                                    />
                                </div>

                                <!-- Port & Encryption -->
                                <div class="grid grid-cols-2 gap-3">
                                    <div>
                                        <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="smtp_port">
                                            Port <span class="text-rose-500">*</span>
                                        </label>
                                        <input
                                            id="smtp_port"
                                            type="number"
                                            bind:value={smtpConfig.port}
                                            placeholder="587 / 465"
                                            class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono text-xs"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="smtp_encryption">
                                            Enkripsi
                                        </label>
                                        <CustomSelect
                                            options={encryptionOptions}
                                            value={smtpConfig.encryption}
                                            fullWidth={true}
                                            on:change={(e) => {
                                                smtpConfig.encryption = e.detail;
                                                if (e.detail === 'ssl') {
                                                    smtpConfig.port = 465;
                                                    smtpConfig.secure = true;
                                                } else if (e.detail === 'tls') {
                                                    smtpConfig.port = 587;
                                                    smtpConfig.secure = false;
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <!-- Username -->
                                <div>
                                    <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="smtp_user">
                                        Username / Email Login
                                    </label>
                                    <input
                                        id="smtp_user"
                                        type="text"
                                        bind:value={smtpConfig.username}
                                        placeholder="Contoh: admin@domain.com atau akun@gmail.com"
                                        class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 text-xs"
                                    />
                                </div>

                                <!-- Password with Visibility Toggle -->
                                <div>
                                    <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="smtp_pass">
                                        Kata Sandi / App Password
                                    </label>
                                    <div class="relative">
                                        {#if showSmtpPassword}
                                            <input
                                                id="smtp_pass"
                                                type="text"
                                                bind:value={smtpConfig.password}
                                                placeholder={smtpConfig.has_password ? '•••••••• (Tersimpan - Kosongkan jika tidak diubah)' : 'Masukkan password atau Google App Password'}
                                                class="w-full pl-4 pr-10 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono text-xs"
                                            />
                                        {:else}
                                            <input
                                                id="smtp_pass"
                                                type="password"
                                                bind:value={smtpConfig.password}
                                                placeholder={smtpConfig.has_password ? '•••••••• (Tersimpan - Kosongkan jika tidak diubah)' : 'Masukkan password atau Google App Password'}
                                                class="w-full pl-4 pr-10 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 font-mono text-xs"
                                            />
                                        {/if}
                                        <button
                                            type="button"
                                            on:click={() => showSmtpPassword = !showSmtpPassword}
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] transition-colors p-1 cursor-pointer"
                                            title={showSmtpPassword ? 'Sembunyikan password' : 'Lihat password'}
                                        >
                                            {#if showSmtpPassword}
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                            {:else}
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            {/if}
                                        </button>
                                    </div>
                                    <p class="text-[10px] text-[var(--text-3)] mt-1">Untuk Gmail, gunakan Google App Password (16 digit) bukan password utama.</p>
                                </div>
                            </div>

                            <!-- Column 2: Sender Identity & App Branding -->
                            <div class="space-y-4">
                                <div class="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-[var(--border)]">
                                    <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span>Identitas Pengirim Email</span>
                                </div>

                                <!-- From Name -->
                                <div>
                                    <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="from_name">
                                        Nama Pengirim (From Name) <span class="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="from_name"
                                        type="text"
                                        bind:value={smtpConfig.from_name}
                                        placeholder="Contoh: AppCenter Support"
                                        class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 text-xs"
                                        required
                                    />
                                    <p class="text-[10px] text-[var(--text-3)] mt-1">Nama yang tampil sebagai pengirim pada kotak masuk pengguna.</p>
                                </div>

                                <!-- From Email -->
                                <div>
                                    <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="from_email">
                                        Email Pengirim (From Email) <span class="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="from_email"
                                        type="email"
                                        bind:value={smtpConfig.from_email}
                                        placeholder="Contoh: noreply@domain.com atau akun@gmail.com"
                                        class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 text-xs"
                                        required
                                    />
                                    <p class="text-[10px] text-[var(--text-3)] mt-1">Alamat email resmi yang mengirimkan kode OTP & notifikasi.</p>
                                </div>

                                <!-- Reply-To -->
                                <div>
                                    <label class="block font-bold text-[var(--text-2)] mb-1 uppercase tracking-wider text-[11px]" for="reply_to">
                                        Email Balasan (Reply-To) <span class="text-[var(--text-3)] font-normal lowercase">(opsional)</span>
                                    </label>
                                    <input
                                        id="reply_to"
                                        type="email"
                                        bind:value={smtpConfig.reply_to}
                                        placeholder="Contoh: support@domain.com"
                                        class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-blue-500 text-xs"
                                    />
                                    <p class="text-[10px] text-[var(--text-3)] mt-1">Alamat tujuan jika pengguna membalas email verifikasi.</p>
                                </div>
                            </div>
                        </div>

                        {#if !smtpConfig.is_active}
                            <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>Saat status dinonaktifkan, email kode OTP verifikasi pendaftaran dan reset password tidak akan dikirimkan ke member.</span>
                            </div>
                        {/if}

                        <!-- Diagnostics & Action Footer -->
                        <div class="border-t border-[var(--border)] pt-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                            
                            <!-- Test Email Dispatcher -->
                            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-xl">
                                <div class="relative flex-1">
                                    <input
                                        type="email"
                                        bind:value={testEmailRecipient}
                                        placeholder="Email penerima tes (cth: email@gmail.com)"
                                        class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <button
                                    type="button"
                                    on:click={runTestSmtp}
                                    disabled={testingSmtp}
                                    class="px-4 py-2.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text)] border border-[var(--border)] text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 flex-shrink-0"
                                >
                                    {#if testingSmtp}
                                        <div class="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Menguji...</span>
                                    {:else}
                                        <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        <span>Kirim Tes Email</span>
                                    {/if}
                                </button>
                            </div>

                            <!-- Primary Save Button -->
                            <div class="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={savingSmtp}
                                    class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {#if savingSmtp}
                                        <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Menyimpan...</span>
                                    {:else}
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Simpan Pengaturan SMTP</span>
                                    {/if}
                                </button>
                            </div>
                        </div>

                        <!-- Test Result Alert Banner -->
                        {#if testResult}
                            <div class="p-4 rounded-2xl border text-xs animate-in fade-in duration-200 {testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'}">
                                <div class="flex items-start gap-2.5">
                                    {#if testResult.success}
                                        <svg class="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    {:else}
                                        <svg class="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    {/if}
                                    <div class="space-y-1">
                                        <div class="font-bold">{testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal'}</div>
                                        <div>{testResult.message}</div>
                                        {#if testResult.details?.messageId}
                                            <div class="text-[11px] opacity-80 font-mono">Message ID: {testResult.details.messageId}</div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </form>
                {/if}
            </div>
            {/if}

            {#if activeTab === 'database'}
            <!-- Page Title & Header Actions -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h1 class="text-lg sm:text-2xl font-black text-[var(--text)] tracking-tight flex items-center gap-2.5">
                        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                            </svg>
                        </div>
                        <span>Backup & Pemeliharaan Database</span>
                    </h1>
                    <p class="text-xs text-[var(--text-3)] mt-1">
                        Pencadangan berkas SQL murni (uncompressed), validasi integritas SHA256, dan audit log pelacakan pengunduhan.
                    </p>
                </div>

                <div class="flex items-center justify-end gap-2 sm:gap-2.5 w-full sm:w-auto">
                    <button
                        type="button"
                        on:click={fetchBackups}
                        class="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] active:scale-95 text-[var(--text-2)] hover:text-[var(--text)] text-xs font-semibold border border-[var(--border)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title="Segarkan data"
                    >
                        <svg class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                    </button>

                    <button
                        type="button"
                        on:click={handleStartBackup}
                        disabled={creatingBackup || !!activeBackup}
                        class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-0 flex items-center justify-center gap-2"
                    >
                        {#if creatingBackup || !!activeBackup}
                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span class="truncate">Mencadangkan...</span>
                        {:else}
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Cadangkan Sekarang</span>
                        {/if}
                    </button>
                </div>
            </div>

            <!-- Top Summary KPI Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                    <div class="flex items-center justify-between text-[var(--text-3)] text-xs mb-1.5 sm:mb-2">
                        <span class="text-[11px] sm:text-xs">Total Cadangan</span>
                        <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                        </div>
                    </div>
                    <div class="text-base sm:text-xl font-bold text-[var(--text)]">{totalBackupsCount} <span class="text-[10px] sm:text-xs font-normal text-[var(--text-3)]">Berkas</span></div>
                    <div class="text-[10px] sm:text-[11px] text-emerald-500 mt-1 font-medium truncate">{completedBackupsCount} Siap Diunduh</div>
                </div>

                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                    <div class="flex items-center justify-between text-[var(--text-3)] text-xs mb-1.5 sm:mb-2">
                        <span class="text-[11px] sm:text-xs">Ruang Arsip</span>
                        <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                    </div>
                    <div class="text-base sm:text-xl font-bold text-[var(--text)] truncate">{formatBytes(totalStorageUsed)}</div>
                    <div class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-1 truncate">Format Raw SQL Murni</div>
                </div>

                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                    <div class="flex items-center justify-between text-[var(--text-3)] text-xs mb-1.5 sm:mb-2">
                        <span class="text-[11px] sm:text-xs">Pengunduhan</span>
                        <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                    <div class="text-base sm:text-xl font-bold text-[var(--text)]">{totalDownloadsCount} <span class="text-[10px] sm:text-xs font-normal text-[var(--text-3)]">Kali</span></div>
                    <div class="text-[10px] sm:text-[11px] text-blue-500 mt-1 font-medium truncate">Dilacak di Audit Log</div>
                </div>

                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                    <div class="flex items-center justify-between text-[var(--text-3)] text-xs mb-1.5 sm:mb-2">
                        <span class="text-[11px] sm:text-xs">Keamanan</span>
                        <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                    </div>
                    <div class="text-base sm:text-xl font-bold text-[var(--text)] truncate">Admin Restrict</div>
                    <div class="text-[10px] sm:text-[11px] text-emerald-500 mt-1 font-medium truncate">Session & IP Validation</div>
                </div>
            </div>

            <!-- Active / Ongoing Backup Live Progress Card -->
            {#if activeBackup}
                <div class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-blue-500/5 border border-blue-500/30 shadow-lg shadow-blue-500/5 relative overflow-hidden animate-in fade-in duration-300">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-[var(--text)]">Pencadangan Database Sedang Berlangsung...</h3>
                                <p class="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">{activeBackup.current_step || 'Memproses...'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{activeBackup.progress}%</span>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div class="w-full h-3 rounded-full bg-blue-500/20 overflow-hidden relative">
                        <div
                            class="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 ease-out rounded-full relative"
                            style="width: {activeBackup.progress}%"
                        >
                            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[var(--text-3)] mt-2.5">
                        <span class="truncate">Berkas: <code class="text-[var(--text)]">{activeBackup.filename}</code></span>
                        <span>Dibuat oleh: <b>{activeBackup.created_by}</b></span>
                    </div>
                </div>
            {/if}

            <!-- Database Backups Table & Mobile Card View Container -->
            <div class="p-4 sm:p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl sm:rounded-3xl shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-3 sm:pb-4 gap-2">
                    <div class="min-w-0">
                        <h2 class="text-sm sm:text-base font-bold text-[var(--text)] truncate">Daftar Arsip Cadangan Database</h2>
                        <p class="text-[11px] sm:text-xs text-[var(--text-3)] truncate sm:whitespace-normal">Klik unduh untuk menyimpan salinan atau periksa log audit unduhan</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] flex-shrink-0">
                        {backups.length} Entri
                    </span>
                </div>

                {#if loading}
                    <div class="py-12 text-center text-[var(--text-3)]">
                        <div class="w-8 h-8 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p class="text-xs">Memuat daftar cadangan database...</p>
                    </div>
                {:else if backups.length === 0}
                    <div class="py-12 text-center text-[var(--text-3)] space-y-3">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                            </svg>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-[var(--text)]">Belum Ada Cadangan Database</h4>
                            <p class="text-xs text-[var(--text-3)] mt-1">Klik tombol "Cadangkan" di atas untuk membuat snapshot pertama.</p>
                        </div>
                    </div>
                {:else}
                    <!-- Desktop Table View (Hidden on Mobile) -->
                    <div class="hidden md:block overflow-x-auto">
                        <table class="w-full text-left text-xs border-collapse table-fixed">
                            <thead>
                                <tr class="border-b border-[var(--border)] bg-[var(--surface-2)]/50 text-[var(--text-3)] font-bold uppercase tracking-wider text-[10px]">
                                    <th class="py-3.5 px-4 w-[34%]">Berkas & Ukuran</th>
                                    <th class="py-3.5 px-3 w-[19%]">Waktu Dibuat</th>
                                    <th class="py-3.5 px-3 w-[18%]">Status & Checksum</th>
                                    <th class="py-3.5 px-3 w-[16%]">Audit Unduhan</th>
                                    <th class="py-3.5 px-4 w-[13%] text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-[var(--border)]">
                                {#each backups as b (b.id)}
                                    <tr class="hover:bg-[var(--surface-2)]/60 transition-colors">
                                        <!-- File & Size -->
                                        <td class="py-3.5 px-4 align-middle">
                                            <div class="flex items-center gap-3 min-w-0">
                                                <div class="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0 shadow-xs">
                                                    <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                                    </svg>
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <span class="font-bold text-[var(--text)] font-mono text-xs truncate block" title={b.filename}>
                                                        {b.filename}
                                                    </span>
                                                    <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mt-1 flex-wrap">
                                                        <span class="font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px]">{formatBytes(b.file_size)}</span>
                                                        <span>•</span>
                                                        <span>{b.table_count} Tabel</span>
                                                        <span>•</span>
                                                        <span>{b.record_count.toLocaleString('id-ID')} Data</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <!-- Created At & Admin -->
                                        <td class="py-3.5 px-3 align-middle">
                                            <div class="font-semibold text-[var(--text)] text-xs">{formatDate(b.created_at)}</div>
                                            <div class="text-[11px] text-[var(--text-3)] mt-0.5 flex items-center gap-1">
                                                <span>Oleh:</span>
                                                <span class="font-medium text-[var(--text-2)]">{b.created_by}</span>
                                            </div>
                                        </td>

                                        <!-- Checksum & Status -->
                                        <td class="py-3.5 px-3 align-middle">
                                            {#if b.status === 'COMPLETED'}
                                                <div class="space-y-1">
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                                        Selesai
                                                    </span>
                                                    {#if b.checksum_sha256}
                                                        <button
                                                            type="button"
                                                            on:click={() => copyToClipboard(b.checksum_sha256 || '', 'SHA256 Checksum')}
                                                            class="text-[10px] text-[var(--text-3)] hover:text-blue-500 font-mono flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                                                            title="Klik untuk salin SHA256 lengkap"
                                                        >
                                                            <span>SHA256: {b.checksum_sha256.slice(0, 8)}...</span>
                                                            <svg class="w-2.5 h-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        </button>
                                                    {/if}
                                                </div>
                                            {:else if b.status === 'IN_PROGRESS' || b.status === 'PENDING'}
                                                <div class="flex items-center gap-1.5">
                                                    <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                                    <span class="text-blue-500 font-bold text-[11px]">{b.progress}%</span>
                                                    <span class="text-[10px] text-[var(--text-3)] truncate">({b.current_step || 'Memproses'})</span>
                                                </div>
                                            {:else}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                    Gagal ✗
                                                </span>
                                            {/if}
                                        </td>

                                        <!-- Download Audit Logs -->
                                        <td class="py-3.5 px-3 align-middle">
                                            {#if b.download_count > 0}
                                                <div class="space-y-1">
                                                    <button
                                                        type="button"
                                                        on:click={() => openAuditModal(b)}
                                                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 transition-all cursor-pointer"
                                                        title="Buka riwayat unduhan lengkap"
                                                    >
                                                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        <span>{b.download_count}x Diunduh</span>
                                                    </button>
                                                    <div class="text-[10px] text-[var(--text-3)] truncate">
                                                        Oleh: <span class="font-medium text-[var(--text-2)]">{b.last_download_by || 'Admin'}</span>
                                                    </div>
                                                </div>
                                            {:else}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
                                                    Belum Diunduh
                                                </span>
                                            {/if}
                                        </td>

                                        <!-- Actions -->
                                        <td class="py-3.5 px-4 text-right align-middle">
                                            <div class="flex items-center justify-end gap-1.5">
                                                {#if b.status === 'COMPLETED'}
                                                    <button
                                                        type="button"
                                                        on:click={() => triggerDownload(b)}
                                                        class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer border-0 flex items-center gap-1.5"
                                                        title="Unduh berkas database"
                                                    >
                                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                        <span>Unduh</span>
                                                    </button>
                                                {/if}

                                                <button
                                                    type="button"
                                                    on:click={() => openDeleteModal(b)}
                                                    class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer border-0 flex items-center justify-center"
                                                    title="Hapus cadangan"
                                                >
                                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    <!-- Mobile Card List View (Visible on Mobile) -->
                    <div class="block md:hidden space-y-3">
                        {#each backups as b (b.id)}
                            <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)]/50 border border-[var(--border)] space-y-3 shadow-xs">
                                <!-- Top Row: Icon + Filename & Status Badge -->
                                <div class="flex items-start justify-between gap-2.5">
                                    <div class="flex items-start gap-2.5 min-w-0">
                                        <div class="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0 mt-0.5">
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                            </svg>
                                        </div>
                                        <div class="min-w-0">
                                            <span class="font-bold text-[var(--text)] font-mono text-xs break-all block leading-tight">
                                                {b.filename}
                                            </span>
                                            <div class="text-[10px] text-[var(--text-3)] flex items-center gap-1 mt-1 flex-wrap">
                                                <span>{formatDate(b.created_at)}</span>
                                                <span>•</span>
                                                <span>oleh <strong class="text-[var(--text-2)] font-medium">{b.created_by}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Status Pill -->
                                    <div class="flex-shrink-0">
                                        {#if b.status === 'COMPLETED'}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                                <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                                                Selesai
                                            </span>
                                        {:else if b.status === 'IN_PROGRESS' || b.status === 'PENDING'}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                                                <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                                {b.progress}%
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                                                Gagal
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <!-- Stats Pills Row: Size, Tables, Records -->
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md text-[10px]">
                                        {formatBytes(b.file_size)}
                                    </span>
                                    <span class="text-[10px] font-medium text-[var(--text-2)] bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                                        {b.table_count} Tabel
                                    </span>
                                    <span class="text-[10px] font-medium text-[var(--text-2)] bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                                        {b.record_count.toLocaleString('id-ID')} Data
                                    </span>
                                </div>

                                <!-- Metadata Box: SHA256 Checksum & Audit Logs -->
                                <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]/70 space-y-2 text-[11px]">
                                    {#if b.checksum_sha256}
                                        <div class="flex items-center justify-between gap-2">
                                            <span class="text-[var(--text-3)] text-[10px] flex-shrink-0">SHA256:</span>
                                            <button
                                                type="button"
                                                on:click={() => copyToClipboard(b.checksum_sha256 || '', 'SHA256 Checksum')}
                                                class="text-[10px] text-[var(--text-2)] hover:text-blue-500 font-mono flex items-center gap-1 bg-[var(--surface-2)] px-2 py-0.5 rounded-md border border-[var(--border)] transition-colors active:scale-95 cursor-pointer max-w-[200px] truncate"
                                                title="Klik untuk salin SHA256 lengkap"
                                            >
                                                <span class="truncate">{b.checksum_sha256.slice(0, 8)}...{b.checksum_sha256.slice(-6)}</span>
                                                <svg class="w-3 h-3 text-[var(--text-3)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    {/if}

                                    <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border)]/50">
                                        <span class="text-[var(--text-3)] text-[10px] flex-shrink-0">Audit Unduhan:</span>
                                        {#if b.download_count > 0}
                                            <button
                                                type="button"
                                                on:click={() => openAuditModal(b)}
                                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 transition-all cursor-pointer active:scale-95"
                                            >
                                                <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                <span>{b.download_count}x Unduh ({b.last_download_by || 'Admin'})</span>
                                            </button>
                                        {:else}
                                            <span class="text-[10px] text-[var(--text-3)]">Belum pernah diunduh</span>
                                        {/if}
                                    </div>
                                </div>

                                <!-- Action Buttons Row -->
                                <div class="flex items-center gap-2 pt-1">
                                    {#if b.status === 'COMPLETED'}
                                        <button
                                            type="button"
                                            on:click={() => triggerDownload(b)}
                                            class="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5 active:scale-98"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            <span>Unduh SQL</span>
                                        </button>
                                    {/if}

                                    <button
                                        type="button"
                                        on:click={() => openDeleteModal(b)}
                                        class="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer border-0 flex items-center justify-center gap-1.5 active:scale-95 text-xs font-semibold"
                                        title="Hapus cadangan"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Hapus</span>
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
            {/if}
        </main>
</AdminLayout>

<!-- Modal Audit Log Pengunduhan -->
{#if auditModalOpen && selectedBackupAudit}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => auditModalOpen = false}>
        <div class="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-[#22314d] pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-[var(--text)]">Log Riwayat Pengunduhan Database</h3>
                        <p class="text-[11px] text-[var(--text-3)] font-mono">{selectedBackupAudit.filename}</p>
                    </div>
                </div>
                <button
                    type="button"
                    on:click={() => auditModalOpen = false}
                    class="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-lg transition-colors cursor-pointer bg-transparent border-0"
                >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {#if !selectedBackupAudit.download_history || selectedBackupAudit.download_history.length === 0}
                <div class="py-8 text-center text-xs text-[var(--text-3)]">
                    Belum ada riwayat pengunduhan yang tercatat untuk berkas ini.
                </div>
            {:else}
                <div class="space-y-2.5">
                    {#each selectedBackupAudit.download_history as log, idx}
                        <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1.5">
                            <div class="flex items-center justify-between">
                                <span class="font-bold text-[var(--text)] flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {log.downloaded_by}
                                </span>
                                <span class="text-[11px] text-[var(--text-3)] font-medium">{formatDate(log.downloaded_at)}</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[var(--text-2)]">
                                <div>
                                    <span class="text-[var(--text-3)]">Browser & OS:</span> {log.browser}
                                </div>
                                <div>
                                    <span class="text-[var(--text-3)]">IP Address:</span> <code class="text-blue-500 font-mono">{log.ip}</code>
                                </div>
                            </div>
                            <div class="text-[10px] text-[var(--text-3)] font-mono break-all bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)]">
                                User-Agent: {log.user_agent}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            <div class="pt-3 border-t border-[var(--border)] flex justify-end">
                <button
                    type="button"
                    on:click={() => auditModalOpen = false}
                    class="px-4 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer border border-[var(--border)]"
                >
                    Tutup
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Modal Konfirmasi Hapus Cadangan -->
{#if deleteModalOpen && backupToDelete}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => deleteModalOpen = false}>
        <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 flex-shrink-0">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-[var(--text)]">Hapus Berkas Cadangan?</h3>
                    <p class="text-xs text-[var(--text-3)]">Tindakan ini permanen dan berkas cadangan database (.sql) akan dihapus dari server.</p>
                </div>
            </div>

            <div class="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text-2)] break-all">
                {backupToDelete.filename}
            </div>

            <div class="flex items-center justify-end gap-2 pt-2">
                <button
                    type="button"
                    on:click={() => deleteModalOpen = false}
                    disabled={deleting}
                    class="px-4 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text)] text-xs font-semibold transition-colors cursor-pointer border border-[var(--border)]"
                >
                    Batal
                </button>
                <button
                    type="button"
                    on:click={confirmDeleteBackup}
                    disabled={deleting}
                    class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer border-0 flex items-center gap-1.5"
                >
                    {#if deleting}
                        <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Menghapus...</span>
                    {:else}
                        <span>Hapus Permanen</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Modal Dokumentasi / Panduan GoQRIS -->
{#if docModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true" on:click|self={() => docModalOpen = false}>
        <div class="w-full max-w-xl rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-[#22314d] px-6 py-5 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/40">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-xs">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-900 dark:text-white">Panduan Pengaturan GoQRIS</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Petunjuk praktis mendapatkan kredensial & integrasi webhook</p>
                    </div>
                </div>
                <button
                    type="button"
                    on:click={() => docModalOpen = false}
                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border-0 bg-transparent"
                    aria-label="Tutup"
                >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Content List -->
            <div class="p-6 overflow-y-auto space-y-4 text-xs">
                <!-- Step 1 -->
                <div class="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-[#22314d] hover:border-blue-500/30 transition-all shadow-xs">
                    <div class="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        1
                    </div>
                    <div class="space-y-1.5 flex-1">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-slate-900 dark:text-white text-xs">Akun Merchant</span>
                            <a href="https://goqris.web.id" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 font-bold text-[11px] bg-blue-500/10 px-2 py-0.5 rounded-md hover:bg-blue-500/20 transition-colors">
                                <span>Buka goqris.web.id</span>
                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                        <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                            Login ke dashboard merchant GoQRIS Anda atau buat akun baru jika belum terdaftar.
                        </p>
                    </div>
                </div>

                <!-- Step 2 -->
                <div class="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-[#22314d] hover:border-blue-500/30 transition-all shadow-xs">
                    <div class="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        2
                    </div>
                    <div class="space-y-2 flex-1">
                        <span class="font-bold text-slate-900 dark:text-white text-xs block">Nama Project Merchant</span>
                        <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                            Di menu <strong class="text-slate-900 dark:text-white">Project</strong>, buat atau salin nama project yang Anda gunakan.
                        </p>
                        <div class="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                            <svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span><strong>Penting:</strong> Nama project harus sama persis (termasuk huruf besar/kecil & spasi) dengan yang ada di GoQRIS.</span>
                        </div>
                    </div>
                </div>

                <!-- Step 3 -->
                <div class="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-[#22314d] hover:border-blue-500/30 transition-all shadow-xs">
                    <div class="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        3
                    </div>
                    <div class="space-y-1.5 flex-1">
                        <span class="font-bold text-slate-900 dark:text-white text-xs block">GoQRIS API Key</span>
                        <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                            Masuk ke detail Project &gt; menu <strong class="text-slate-900 dark:text-white">Developer / API Settings</strong>. Salin API Key (berawalan <code class="text-blue-600 dark:text-blue-400 font-mono font-bold">GO_</code>) lalu tempel pada form pengaturan ini.
                        </p>
                    </div>
                </div>

                <!-- Step 4 -->
                <div class="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-[#0c1426] border border-slate-200 dark:border-[#22314d] hover:border-emerald-500/30 transition-all shadow-xs">
                    <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        4
                    </div>
                    <div class="space-y-2 flex-1">
                        <span class="font-bold text-slate-900 dark:text-white text-xs block">Webhook URL (Callback Notification)</span>
                        <p class="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                            Tempelkan URL di bawah pada pengaturan Webhook / Callback di GoQRIS agar verifikasi pembayaran terjadi otomatis secara instan:
                        </p>
                        <div class="flex items-center gap-2 bg-white dark:bg-[#111c35] p-2 rounded-xl border border-slate-200 dark:border-[#22314d]">
                            <code class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex-1 truncate select-all px-1">{typeof window !== 'undefined' ? window.location.origin : ''}/payment/notification</code>
                            <button
                                type="button"
                                on:click={() => copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/payment/notification`, 'Webhook URL')}
                                class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-xs border-0 cursor-pointer flex items-center gap-1"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                <span>Salin</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-slate-200 dark:border-[#22314d] bg-slate-50/50 dark:bg-[#0c1426] flex justify-end">
                <button
                    type="button"
                    on:click={() => docModalOpen = false}
                    class="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm cursor-pointer border-0"
                >
                    Selesai & Tutup
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>

