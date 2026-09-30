export interface InvoicePdfData {
    invoiceNumber: string;
    createdDate: string;
    expiredDate: string;
    paidDate?: string;
    status: string;
    isPaid: boolean;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerCompany?: string;
    items: Array<{
        name: string;
        duration: string;
        price: number;
        description?: string;
        hasTutorials?: boolean;
        tutorialUrl?: string;
        downloadUrl?: string;
    }>;
    subtotal: number;
    adminFee: number;
    discount: number;
    voucherCode?: string;
    uniqueCode?: number;
    totalAmount: number;
    paymentUrl?: string;
    licenseToken?: string;
}

export function renderInvoiceHtml(data: InvoicePdfData): string {
    const generatePage = (lang: 'en' | 'id') => {
        const isEn = lang === 'en';
        
        const labels = {
            status: isEn ? (data.isPaid ? 'PAID' : 'PENDING PAYMENT') : (data.isPaid ? 'LUNAS' : 'MENUNGGU PEMBAYARAN'),
            billedTo: isEn ? 'Billed To (Customer)' : 'Ditagihkan Kepada (Pelanggan)',
            billingInfo: isEn ? 'Billing Info & Dates' : 'Informasi Tagihan & Tanggal',
            issueDate: isEn ? 'Issue Date:' : 'Tanggal Terbit:',
            dueDate: isEn ? 'Due Date:' : 'Jatuh Tempo:',
            paymentTime: isEn ? 'Payment Time:' : 'Waktu Pelunasan:',
            paymentStatus: isEn ? 'Payment Status:' : 'Status Pembayaran:',
            pendingPayment: isEn ? 'Pending Payment' : 'Menunggu Pembayaran',
            description: isEn ? 'Product & Service Description' : 'Deskripsi Produk & Layanan',
            duration: isEn ? 'License Duration' : 'Durasi Lisensi',
            unitPrice: isEn ? 'Unit Price' : 'Harga Satuan',
            subtotal: isEn ? 'Product Subtotal:' : 'Subtotal Produk:',
            discount: isEn ? `Discount (${data.voucherCode || 'Voucher'}):` : `Diskon Potongan (${data.voucherCode || 'Voucher'}):`,
            adminFee: isEn ? 'Handling Fee (Admin):' : 'Biaya Penanganan (Admin):',
            uniqueCode: isEn ? 'Unique Code:' : 'Kode Unik:',
            total: isEn ? 'Total Amount:' : 'Total Tagihan:',
            licenseKey: isEn ? 'Product License Key / Activation Code' : 'Kunci Lisensi Produk / Kode Aktivasi',
            thankYouTitle: isEn ? 'Thank you for your order!' : 'Terima kasih atas pesanannya!',
            thankYouDesc: isEn ? 'Payment has been received. Your license is active and ready to use:' : 'Pembayaran telah kami terima. Lisensi Anda sudah aktif dan siap digunakan:',
            downloadInstaller: isEn ? 'Download App Installer' : 'Pusat Unduhan Installer',
            videoTutorial: isEn ? 'Video Tutorial & Guide' : 'Pusat Video Tutorial',
            actionRequired: isEn ? 'Action Required: Complete your payment to get the license' : 'Tindakan Diperlukan: Selesaikan pembayaran Anda untuk mendapatkan lisensi',
            payNow: isEn ? 'Pay Now / Checkout' : 'Bayar Sekarang / Checkout',
            notes: isEn ? 'This is an official system-generated invoice from Ziqva Labs. No signature is required.' : 'Ini adalah faktur resmi yang dihasilkan sistem dari Ziqva Labs. Tidak diperlukan tanda tangan.',
            officialReceipt: isEn ? 'OFFICIAL RECEIPT' : 'TANDA TERIMA RESMI',
            unpaidInvoice: isEn ? 'UNPAID INVOICE' : 'FAKTUR BELUM LUNAS',
            defaultDesc: isEn ? 'Official exclusive digital license activation' : 'Aktivasi lisensi digital eksklusif resmi',
            contactUs: isEn ? 'Contact Us' : 'Hubungi Kami'
        };

        const statusColor = data.isPaid ? '#047857' : '#d97706';
        const statusBg = data.isPaid ? '#ecfdf5' : '#fffbeb';
        const statusBorder = data.isPaid ? '#a7f3d0' : '#fde68a';

        return `
    <div class="invoice-wrapper">
        <!-- Header -->
        <div class="header-container">
            <div class="brand-section">
                <div class="brand-logo-bg">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 19.2727C22 20.779 20.779 22 19.2727 22H14.7273C13.221 22 12 20.779 12 19.2727V12H19.2727C20.779 12 22 13.221 22 14.7273V19.2727Z" fill="#68C4FF"/>
                        <path d="M20 2C21.1046 2 22 2.89543 22 4V7C22 8.10457 21.1046 9 20 9H17C15.8954 9 15 8.10457 15 7V4C15 2.89543 15.8954 2 17 2H20Z" fill="#0C79D8"/>
                        <path d="M7 15C8.10457 15 9 15.8954 9 17V20C9 21.1046 8.10457 22 7 22H4C2.89543 22 2 21.1046 2 20V17C2 15.8954 2.89543 15 4 15H7Z" fill="#0C79D8"/>
                        <path d="M12 12H4.72727C3.22104 12 2 10.779 2 9.27273V4.72727C2 3.22104 3.22104 2 4.72727 2H9.27273C10.779 2 12 3.22104 12 4.72727V12Z" fill="#2E9EFF"/>
                    </svg>
                </div>
                <div>
                    <div class="brand-title">Ziqva Labs</div>
                </div>
            </div>
            <div class="invoice-meta-top">
                <div><span class="status-badge" style="color: ${statusColor}; background-color: ${statusBg}; border-color: ${statusBorder};">${labels.status}</span></div>
                <div class="invoice-number-tag">${data.invoiceNumber}</div>
            </div>
        </div>

        <!-- Two Column Meta Info Cards -->
        <div class="info-grid">
            <!-- Customer Info -->
            <div class="info-card">
                <div class="card-header-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${labels.billedTo}
                </div>
                <div class="card-main-name">${data.customerName}</div>
                ${data.customerCompany ? `
                <div class="info-item-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    <span style="font-weight: 700; color: #334155;">${data.customerCompany}</span>
                </div>` : ''}
                <div class="info-item-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    <span>${data.customerEmail}</span>
                </div>
                ${data.customerPhone ? `
                <div class="info-item-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    <span>${data.customerPhone}</span>
                </div>` : ''}
            </div>

            <!-- Transaction Dates & Status -->
            <div class="info-card">
                <div class="card-header-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    ${labels.billingInfo}
                </div>
                <div class="date-row">
                    <span class="date-label">${labels.issueDate}</span>
                    <span class="date-val">${data.createdDate}</span>
                </div>
                ${!data.isPaid ? `
                <div class="date-row">
                    <span class="date-label">${labels.dueDate}</span>
                    <span class="date-val">${data.expiredDate}</span>
                </div>
                ` : ''}
                ${data.paidDate ? `
                <div class="date-row" style="margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                    <span class="date-label" style="color: #059669; font-weight: 700;">${labels.paymentTime}</span>
                    <span class="date-val" style="color: #059669; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ${data.paidDate}
                    </span>
                </div>` : `
                <div class="date-row" style="margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                    <span class="date-label" style="color: #d97706; font-weight: 700;">${labels.paymentStatus}</span>
                    <span class="date-val" style="color: #d97706; font-weight: 800;">${labels.pendingPayment}</span>
                </div>`}
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 50%;">${labels.description}</th>
                    <th style="width: 25%;">${labels.duration}</th>
                    <th style="width: 25%; text-align: right;">${labels.unitPrice}</th>
                </tr>
            </thead>
            <tbody>
                ${data.items.map(item => `
                    <tr>
                        <td>
                            <div class="item-title-box">
                                <span class="item-name">${item.name}</span>
                                <span class="item-desc">${item.description || labels.defaultDesc}</span>
                            </div>
                        </td>
                        <td style="font-weight: 700; color: #334155;">${item.duration}</td>
                        <td style="text-align: right; font-weight: 800; color: #0f172a;">Rp ${item.price.toLocaleString('id-ID')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <!-- Summary -->
        <div class="summary-container">
            <table class="summary-table">
                <tr>
                    <td class="label-col">${labels.subtotal}</td>
                    <td class="val-col">Rp ${data.subtotal.toLocaleString('id-ID')}</td>
                </tr>
                ${data.discount > 0 ? `
                <tr>
                    <td class="label-col">${labels.discount}</td>
                    <td class="val-col" style="color: #dc2626; font-weight: 800;">- Rp ${data.discount.toLocaleString('id-ID')}</td>
                </tr>` : ''}
                ${data.adminFee > 0 ? `
                <tr>
                    <td class="label-col">${labels.adminFee}</td>
                    <td class="val-col">Rp ${data.adminFee.toLocaleString('id-ID')}</td>
                </tr>` : ''}
                ${(data.uniqueCode && data.uniqueCode > 0) ? `
                <tr>
                    <td class="label-col">${labels.uniqueCode}</td>
                    <td class="val-col" style="color: #2563eb; font-weight: 700;">+ Rp ${data.uniqueCode.toLocaleString('id-ID')}</td>
                </tr>` : ''}
                <tr class="total-row">
                    <td class="label-col" style="color: #0f172a;">${labels.total}</td>
                    <td class="val-col">Rp ${data.totalAmount.toLocaleString('id-ID')}</td>
                </tr>
            </table>
        </div>

        <!-- Call to Action / License Box -->
        ${data.isPaid && data.licenseToken ? `
        <div class="action-box license-box">
            <div style="font-size: 13px; font-weight: 800; color: #15803d; margin-bottom: 2px;">
                ${labels.thankYouTitle}
            </div>
            <div style="font-size: 11px; color: #166534; margin-bottom: 8px;">
                ${labels.thankYouDesc}
            </div>
            <div class="license-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align: -1px; margin-right: 4px;"><path d="M21 2l-2 2m-1.5 1.5L16 7m-1.5 1.5L13 10m-1.5 1.5L7 16l-4 4 1 1 4-4 4.5-4.5M16 7l2 2-6 6-2-2 6-6z"></path><circle cx="7.5" cy="16.5" r="1.5"></circle></svg>
                ${labels.licenseKey}
            </div>
            <div class="license-key">${data.licenseToken}</div>

            <!-- Quick Links for Download & Tutorial -->
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #bbf7d0; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
                ${data.items.map(it => `
                    ${it.downloadUrl ? `
                    <a href="${it.downloadUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; background: #ffffff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 10px; font-weight: 700; text-decoration: none;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        <span>${labels.downloadInstaller} (${it.name})</span>
                    </a>` : ''}
                    ${it.hasTutorials && it.tutorialUrl ? `
                    <a href="${it.tutorialUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; background: #ffffff; color: #7c3aed; border: 1px solid #ddd6fe; border-radius: 6px; font-size: 10px; font-weight: 700; text-decoration: none;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <span>${labels.videoTutorial} (${it.name})</span>
                    </a>` : ''}
                `).join('')}
            </div>
        </div>
        ` : (!data.isPaid && data.paymentUrl ? `
        <div class="action-box pay-box">
            <div class="pay-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align: -1px; margin-right: 4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                ${labels.actionRequired}
            </div>
            <a href="${data.paymentUrl}" class="pay-btn">→ ${labels.payNow}</a>
        </div>
        ` : '')}

        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; gap: 20px;">
            <div style="flex: 1;">
                <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 13px;">${labels.contactUs}</h4>
                <div style="display: flex; flex-direction: column; gap: 8px; color: #475569; font-size: 12px;">
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span>Perumahan Tirta Sani, Karangploso, Malang, Jawa Timur 65153</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        <span>support@ziqvastore.com</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        <span>+62 812-3456-7890</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Official Footer Stamp & Notes -->
        <div class="footer-section">
            <div class="footer-notes">
                <strong>Ziqva Labs</strong><br/>
                ${labels.notes}
            </div>
            <div class="footer-stamp" style="border-color: ${data.isPaid ? '#059669' : '#dc2626'}; color: ${data.isPaid ? '#059669' : '#dc2626'}; background: ${data.isPaid ? '#ecfdf5' : '#fef2f2'};">
                ${data.isPaid ? labels.officialReceipt : labels.unpaidInvoice}
            </div>
        </div>
    </div>
        `;
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <title>Invoice ${data.invoiceNumber}</title>
    <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.5;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .page-break {
            page-break-before: always;
        }
        .invoice-wrapper {
            width: 210mm;
            min-height: 297mm;
            background: #ffffff;
            padding: 16mm 20mm;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
        }
        
        /* Modern Header Banner */
        .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 22px;
            border-bottom: 2px solid #e2e8f0;
            margin-bottom: 24px;
        }
        .brand-section {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .brand-logo-bg {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .brand-logo { width: 26px; height: 26px; }
        .brand-title { font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; line-height: 1; margin-bottom: 0; }
        
        .invoice-meta-top { text-align: right; }
        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 5px 14px;
            border-radius: 20px;
            font-weight: 800;
            font-size: 11px;
            border: 1.5px solid transparent;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 6px;
        }
        .invoice-number-tag {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
        }
        
        /* Two Column Cards for Customer & Metadata */
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
        }
        .info-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px 18px;
        }
        .card-header-title {
            font-size: 10px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }
        .card-main-name { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
        .card-sub-text { font-size: 12px; color: #475569; font-weight: 500; line-height: 1.6; }
        .info-item-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569; margin-top: 3px; }

        .date-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
        .date-label { color: #64748b; font-weight: 500; }
        .date-val { font-weight: 700; color: #0f172a; }

        /* Items Table */
        table.items-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-bottom: 24px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
        }
        table.items-table th {
            background: #f1f5f9;
            color: #334155;
            text-align: left;
            padding: 12px 18px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            border-bottom: 1px solid #cbd5e1;
        }
        table.items-table td {
            padding: 14px 18px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
            color: #334155;
            vertical-align: middle;
        }
        table.items-table tr:last-child td { border-bottom: none; }
        .item-title-box { display: flex; flex-direction: column; }
        .item-name { font-weight: 800; color: #0f172a; font-size: 13px; }
        .item-desc { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 400; }
        
        /* Summary Box */
        .summary-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 24px;
        }
        table.summary-table { width: 360px; border-collapse: collapse; }
        table.summary-table td { padding: 8px 14px; font-size: 13px; border-bottom: 1px solid #f8fafc; }
        table.summary-table td.label-col { color: #64748b; text-align: right; font-weight: 500; }
        table.summary-table td.val-col { text-align: right; font-weight: 700; color: #0f172a; }
        table.summary-table tr.total-row td {
            border-top: 2px solid #0f172a;
            border-bottom: none;
            padding-top: 12px;
            padding-bottom: 12px;
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            background: #f8fafc;
        }
        table.summary-table tr.total-row td.val-col { color: #2563eb; font-size: 17px; font-weight: 900; }

        /* License / Payment Action Box */
        .action-box {
            border-radius: 12px;
            padding: 14px 20px;
            margin-bottom: 24px;
            text-align: center;
        }
        .license-box { background: #f0fdf4; border: 1.5px dashed #22c55e; }
        .license-label { font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; }
        .license-key { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 17px; font-weight: 900; color: #166534; letter-spacing: 2px; }
        
        .pay-box { background: #fffbeb; border: 1.5px dashed #f59e0b; }
        .pay-label { font-size: 11px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; }
        .pay-btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 800; padding: 10px 24px; border-radius: 8px; font-size: 12px; letter-spacing: 0.5px; }

        /* Official Footer Stamp & Notes */
        .footer-section {
            border-top: 1.5px solid #e2e8f0;
            padding-top: 18px;
            margin-top: auto;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        .footer-notes { color: #64748b; font-size: 11px; line-height: 1.6; max-width: 65%; }
        .footer-stamp {
            text-align: center;
            border: 2px solid #059669;
            color: #059669;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 900;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: #ecfdf5;
        }
    </style>
</head>
<body>
    ${generatePage('en')}
    <div class="page-break"></div>
    ${generatePage('id')}
</body>
</html>`;
}