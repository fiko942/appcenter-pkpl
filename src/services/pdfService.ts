import PDFDocument from 'pdfkit';
import { InvoicePdfData } from '../views/invoicePdfTemplate';

/**
 * Super lightweight, pure Node.js PDF generator using PDFKit.
 * Generates an official 2-page invoice document:
 * - Page 1: Versi Bahasa Indonesia
 * - Page 2: English Version
 */
export async function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40,
                autoFirstPage: false,
                info: {
                    Title: `Invoice ${data.invoiceNumber}`,
                    Author: 'Ziqva Labs'
                }
            });

            const buffers: Buffer[] = [];
            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const formatRupiah = (val: number) => {
                return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
            };

            const primaryColor = '#1e293b';
            const accentBlue = '#2563eb';
            const statusColor = data.isPaid ? '#059669' : '#d97706';
            const statusBg = data.isPaid ? '#ecfdf5' : '#fffbeb';
            const textMuted = '#64748b';
            const borderColor = '#e2e8f0';

            const renderPage = (lang: 'id' | 'en') => {
                doc.addPage({ size: 'A4', margin: 40 });

                const isEn = lang === 'en';
                const labels = {
                    subHeader: isEn ? 'Digital Software & Automation Hub' : 'Pusat Software Otomatisasi Digital',
                    status: isEn ? (data.isPaid ? 'PAID' : 'PENDING PAYMENT') : (data.isPaid ? 'LUNAS' : 'MENUNGGU PEMBAYARAN'),
                    customerTitle: isEn ? 'BILLED TO (CUSTOMER)' : 'DITAGIHKAN KEPADA (PELANGGAN)',
                    billingTitle: isEn ? 'BILLING & PAYMENT INFO' : 'INFORMASI TAGIHAN & PEMBAYARAN',
                    issueDate: isEn ? 'Issue Date:' : 'Tanggal Terbit:',
                    dueDate: isEn ? 'Due Date:' : 'Jatuh Tempo:',
                    paidDate: isEn ? 'Paid At:' : 'Waktu Bayar:',
                    statusText: isEn ? 'Payment Status:' : 'Status:',
                    statusVal: isEn ? (data.isPaid ? 'Paid' : 'Pending') : (data.isPaid ? 'Lunas' : 'Menunggu'),
                    thDesc: isEn ? 'PRODUCT & SERVICE DESCRIPTION' : 'DESKRIPSI PRODUK / LAYANAN',
                    thDuration: isEn ? 'DURATION' : 'DURASI',
                    thPrice: isEn ? 'AMOUNT' : 'TOTAL HARGA',
                    defaultDesc: isEn ? 'Official exclusive digital license activation' : 'Aktivasi lisensi resmi Ziqva Labs',
                    subtotal: isEn ? 'Product Subtotal:' : 'Subtotal Produk:',
                    discount: isEn ? 'Discount Voucher:' : 'Diskon Potongan:',
                    fee: isEn ? 'Handling Fee:' : 'Biaya Layanan:',
                    total: isEn ? 'Total Amount:' : 'Total Tagihan:',
                    licenseTitle: isEn ? 'OFFICIAL LICENSE ACTIVATION KEY' : 'KODE AKTIVASI LISENSI RESMI',
                    contactTitle: isEn ? 'Contact Us & Support:' : 'Hubungi Kami & Dukungan:',
                    disclaimer: isEn
                        ? 'This is an official computer-generated receipt from Ziqva Labs. No physical signature is required.'
                        : 'Dokumen ini diterbitkan secara otomatis oleh sistem Ziqva Labs dan sah tanpa tanda tangan basah.',
                    pageIndicator: isEn ? 'Page 2 of 2 (English Version)' : 'Halaman 1 dari 2 (Versi Bahasa Indonesia)'
                };

                // --- HEADER ---
                doc.fontSize(20).font('Helvetica-Bold').fillColor(primaryColor).text('Ziqva Labs', 40, 40);
                doc.fontSize(9).font('Helvetica').fillColor(textMuted).text(labels.subHeader, 40, 64);

                // Status Badge
                doc.roundedRect(380, 40, 175, 24, 6).fillAndStroke(statusBg, data.isPaid ? '#10b981' : '#f59e0b');
                doc.fontSize(9).font('Helvetica-Bold').fillColor(statusColor).text(labels.status, 380, 47, { width: 175, align: 'center' });

                // Invoice Title
                doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor).text(data.invoiceNumber, 380, 72, { width: 175, align: 'right' });

                // Divider
                doc.moveTo(40, 100).lineTo(555, 100).strokeColor(borderColor).stroke();

                // --- TWO COLUMN METADATA ---
                // Customer Box
                doc.roundedRect(40, 115, 250, 95, 8).fillAndStroke('#f8fafc', borderColor);
                doc.fontSize(8).font('Helvetica-Bold').fillColor(textMuted).text(labels.customerTitle, 52, 125);
                doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text(data.customerName || 'Customer', 52, 140);
                doc.fontSize(9).font('Helvetica').fillColor(textMuted).text(data.customerEmail || '', 52, 156);
                if (data.customerPhone) {
                    doc.fontSize(9).font('Helvetica').fillColor(textMuted).text(data.customerPhone, 52, 170);
                }

                // Billing Info Box
                doc.roundedRect(305, 115, 250, 95, 8).fillAndStroke('#f8fafc', borderColor);
                doc.fontSize(8).font('Helvetica-Bold').fillColor(textMuted).text(labels.billingTitle, 317, 125);
                
                doc.fontSize(8.5).font('Helvetica').fillColor(textMuted).text(labels.issueDate, 317, 142);
                doc.font('Helvetica-Bold').fillColor(primaryColor).text(data.createdDate, 380, 142, { align: 'right', width: 165 });

                if (!data.isPaid && data.expiredDate) {
                    doc.fontSize(8.5).font('Helvetica').fillColor(textMuted).text(labels.dueDate, 317, 160);
                    doc.font('Helvetica-Bold').fillColor('#b45309').text(data.expiredDate, 380, 160, { align: 'right', width: 165 });
                } else if (data.paidDate) {
                    doc.fontSize(8.5).font('Helvetica').fillColor(textMuted).text(labels.paidDate, 317, 160);
                    doc.font('Helvetica-Bold').fillColor('#059669').text(data.paidDate, 380, 160, { align: 'right', width: 165 });
                }

                doc.fontSize(8.5).font('Helvetica').fillColor(textMuted).text(labels.statusText, 317, 178);
                doc.font('Helvetica-Bold').fillColor(statusColor).text(labels.statusVal, 380, 178, { align: 'right', width: 165 });

                // --- TABLE OF ITEMS ---
                const tableTop = 230;
                doc.roundedRect(40, tableTop, 515, 26, 4).fill(primaryColor);
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
                doc.text(labels.thDesc, 52, tableTop + 9);
                doc.text(labels.thDuration, 340, tableTop + 9);
                doc.text(labels.thPrice, 450, tableTop + 9, { width: 95, align: 'right' });

                let yPos = tableTop + 34;
                const items = Array.isArray(data.items) ? data.items : [];

                items.forEach((item) => {
                    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text(item.name, 52, yPos);
                    doc.fontSize(8).font('Helvetica').fillColor(textMuted).text(item.description || labels.defaultDesc, 52, yPos + 13);
                    doc.fontSize(9).font('Helvetica').fillColor(primaryColor).text(item.duration, 340, yPos + 4);
                    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text(formatRupiah(item.price), 450, yPos + 4, { width: 95, align: 'right' });

                    yPos += 36;
                    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor('#f1f5f9').stroke();
                    yPos += 8;
                });

                // --- TOTALS BREAKDOWN ---
                const totalsY = Math.max(yPos + 10, 360);
                const totalsX = 330;
                const totalsWidth = 225;

                doc.fontSize(9).font('Helvetica').fillColor(textMuted).text(labels.subtotal, totalsX, totalsY);
                doc.font('Helvetica-Bold').fillColor(primaryColor).text(formatRupiah(data.subtotal), totalsX, totalsY, { width: totalsWidth, align: 'right' });

                let currentTotalY = totalsY + 18;

                if (data.discount > 0) {
                    doc.font('Helvetica').fillColor('#10b981').text(labels.discount, totalsX, currentTotalY);
                    doc.font('Helvetica-Bold').fillColor('#10b981').text(`- ${formatRupiah(data.discount)}`, totalsX, currentTotalY, { width: totalsWidth, align: 'right' });
                    currentTotalY += 18;
                }

                if (data.adminFee > 0) {
                    doc.font('Helvetica').fillColor(textMuted).text(labels.fee, totalsX, currentTotalY);
                    doc.font('Helvetica-Bold').fillColor(primaryColor).text(formatRupiah(data.adminFee), totalsX, currentTotalY, { width: totalsWidth, align: 'right' });
                    currentTotalY += 18;
                }

                // Total Border
                doc.moveTo(totalsX, currentTotalY + 2).lineTo(555, currentTotalY + 2).strokeColor(borderColor).stroke();
                currentTotalY += 8;

                doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text(labels.total, totalsX, currentTotalY);
                doc.fontSize(13).font('Helvetica-Bold').fillColor(accentBlue).text(formatRupiah(data.totalAmount), totalsX, currentTotalY, { width: totalsWidth, align: 'right' });

                // --- LICENSE KEY BANNER (IF PAID) ---
                if (data.licenseToken) {
                    const thankYouTitle = isEn ? 'Order Completed & License Activated' : 'Pembayaran Diterima & Lisensi Aktif';
                    const thankYouDesc = isEn ? 'Thank you for your order! Your software license is officially registered and ready to use:' : 'Terima kasih atas pesanannya! Lisensi software Anda telah aktif dan siap digunakan:';
                    const dlLabel = isEn ? 'Pusat Unduhan Installer' : 'Pusat Unduhan Installer';
                    const tutLabel = isEn ? 'Pusat Video Tutorial' : 'Pusat Video Tutorial';

                    // Collect quick action links
                    const actionLinks: Array<{ text: string; url: string; color: string; bg: string; border: string }> = [];
                    items.forEach((it) => {
                        if (it.downloadUrl) {
                            actionLinks.push({
                                text: `${dlLabel} (${it.name})`,
                                url: it.downloadUrl,
                                color: '#0f172a',
                                bg: '#f8fafc',
                                border: '#cbd5e1'
                            });
                        }
                        if (it.hasTutorials && it.tutorialUrl) {
                            actionLinks.push({
                                text: `${tutLabel} (${it.name})`,
                                url: it.tutorialUrl,
                                color: '#475569',
                                bg: '#f8fafc',
                                border: '#cbd5e1'
                            });
                        }
                    });

                    const licenseBoxY = currentTotalY + 28;
                    const baseBoxHeight = actionLinks.length > 0 ? 104 : 72;

                    // Clean corporate light slate container with crisp dark slate border
                    doc.roundedRect(40, licenseBoxY, 515, baseBoxHeight, 8).fillAndStroke('#f8fafc', '#cbd5e1');
                    
                    // Status title & subtitle
                    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(thankYouTitle, 54, licenseBoxY + 12);
                    doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(thankYouDesc, 54, licenseBoxY + 26);

                    // License key label & input-like code box
                    const keyBoxY = licenseBoxY + 42;
                    doc.roundedRect(54, keyBoxY, 487, 24, 4).fillAndStroke('#ffffff', '#e2e8f0');
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('KODE AKTIVASI LISENSI RESMI:', 62, keyBoxY + 7);
                    doc.fontSize(10).font('Courier-Bold').fillColor('#0f172a').text(data.licenseToken, 210, keyBoxY + 6);

                    // Action buttons with clickable links
                    if (actionLinks.length > 0) {
                        let linkX = 54;
                        const linkY = licenseBoxY + 74;
                        doc.font('Helvetica-Bold').fontSize(8);
                        actionLinks.forEach((link) => {
                            const textW = doc.widthOfString(link.text);
                            const btnWidth = Math.min(235, textW + 18);
                            doc.roundedRect(linkX, linkY, btnWidth, 20, 4).fillAndStroke(link.bg, link.border);
                            doc.font('Helvetica-Bold').fontSize(8).fillColor(link.color).text(link.text, linkX, linkY + 5.5, {
                                width: btnWidth,
                                align: 'center',
                                link: link.url
                            });
                            linkX += btnWidth + 10;
                        });
                    }
                }

                // --- FOOTER & CONTACT US ---
                const footerY = 700;
                doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(borderColor).stroke();

                doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryColor).text(labels.contactTitle, 40, footerY + 12);
                doc.fontSize(8).font('Helvetica').fillColor(textMuted).text('Perumahan Tirta Sani, Karangploso, Malang, Jawa Timur 65153', 40, footerY + 24);
                doc.fontSize(8).font('Helvetica').fillColor(textMuted).text('Email: support@ziqvastore.com  •  WhatsApp: +62 812-3456-7890', 40, footerY + 36);

                doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text(labels.disclaimer, 40, footerY + 52, { align: 'center', width: 515 });
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(labels.pageIndicator, 40, footerY + 64, { align: 'center', width: 515 });
            };

            // Generate Page 1: Bahasa Indonesia
            renderPage('id');

            // Generate Page 2: English
            renderPage('en');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
