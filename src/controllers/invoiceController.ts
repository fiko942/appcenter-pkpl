import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { ensureOrderInvoiceToken } from '../utils/invoiceToken';
import { generateInvoicePdfBuffer } from '../services/pdfService';
import { InvoicePdfData } from '../views/invoicePdfTemplate';

export class InvoiceController {
    async getInvoiceDataByToken(req: Request, res: Response) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

        const token = String(req.params.token || '');
        try {
            // Support lookup by UUID/hash token OR by inv_{order_id} fallback
            let order = await prisma.order_list.findFirst({
                where: { invoice_token: token }
            });

            if (!order && token.startsWith('inv_')) {
                const rawId = parseInt(token.replace('inv_', ''), 10);
                if (!isNaN(rawId)) {
                    order = await prisma.order_list.findFirst({
                        where: { id: rawId }
                    });
                }
            }

            if (!order) {
                return res.status(404).json({ status: 'error', message: 'Invoice tidak ditemukan' });
            }

            let itemsParsed: any = null;
            try {
                itemsParsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            } catch (e) {
                itemsParsed = null;
            }

            const isPaid = order.status === 'Order has been complete' || order.status === 'COMPLETED';

            // Resolve all products to map product tutorials and download hub query links
            const allProducts = await prisma.products.findMany({
                select: { id: true, name: true, tutorials: true, installer_files: true, product_id: true }
            });
            const productByIdMap = new Map<number, typeof allProducts[0]>();
            const productByNameMap = new Map<string, typeof allProducts[0]>();
            allProducts.forEach(p => {
                productByIdMap.set(p.id, p);
                if (p.product_id) productByIdMap.set(p.product_id, p);
                if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
            });

            const getProductMatch = (item: any) => {
                const dbId = Number(item?.db_id || item?.id || 0);
                const prodId = Number(item?.product_id || 0);
                const nameKey = (item?.name || item?.product_name || '').trim().toLowerCase();
                return productByIdMap.get(dbId) || productByIdMap.get(prodId) || productByNameMap.get(nameKey) || null;
            };

            const parseProductHasTutorials = (prod: typeof allProducts[0] | null): boolean => {
                if (!prod?.tutorials) return false;
                try {
                    const parsed = typeof prod.tutorials === 'string' ? JSON.parse(prod.tutorials) : prod.tutorials;
                    return Array.isArray(parsed) && parsed.length > 0;
                } catch {
                    return false;
                }
            };

            let itemsFinal: any[] = [];
            let subtotal = 0;
            const fallbackDurationMonths = Math.round(order.duration / 43800) || 1;

            if (Array.isArray(itemsParsed) && itemsParsed.length > 0) {
                itemsFinal = itemsParsed.map(item => {
                    const durMonths = item.duration_months || fallbackDurationMonths;
                    let price = item.final_unit_price || item.price || 0;
                    if (item.final_unit_price && durMonths > 1) {
                        price = item.final_unit_price * durMonths;
                    } else if (item.price && durMonths > 1 && item.price === item.final_unit_price) {
                        price = item.price * durMonths;
                    }

                    subtotal += price;
                    let durStr = item.duration_text || item.duration;
                    if (!durStr && item.duration_months) durStr = `${item.duration_months} Bulan`;
                    if (!durStr) durStr = `${fallbackDurationMonths} Bulan`;

                    const matchedProd = getProductMatch(item);
                    const hasTutorials = parseProductHasTutorials(matchedProd);
                    const productName = item.name || item.product_name || matchedProd?.name || 'Software Subscription';
                    const targetProdId = matchedProd ? matchedProd.id : (item.db_id || item.id || null);

                    const downloadUrl = targetProdId 
                        ? `/#/member/downloads?id=${targetProdId}&search=${encodeURIComponent(productName)}`
                        : `/#/member/downloads?search=${encodeURIComponent(productName)}`;

                    return {
                        name: productName,
                        duration: durStr,
                        price: price,
                        productId: targetProdId,
                        hasTutorials: hasTutorials,
                        tutorialUrl: hasTutorials && targetProdId ? `/#/member/tutorials/${targetProdId}` : null,
                        downloadUrl: downloadUrl
                    };
                });
            } else {
                subtotal = order.total_amount || 0;
                const matchedProd = getProductMatch(itemsParsed);
                const hasTutorials = parseProductHasTutorials(matchedProd);
                const productName = itemsParsed?.name || itemsParsed?.product_name || matchedProd?.name || 'Software Subscription';
                const targetProdId = matchedProd ? matchedProd.id : null;

                const downloadUrl = targetProdId 
                    ? `/#/member/downloads?id=${targetProdId}&search=${encodeURIComponent(productName)}`
                    : `/#/member/downloads?search=${encodeURIComponent(productName)}`;

                itemsFinal = [
                    {
                        name: productName,
                        duration: `${fallbackDurationMonths} Bulan`,
                        price: subtotal,
                        productId: targetProdId,
                        hasTutorials: hasTutorials,
                        tutorialUrl: hasTutorials && targetProdId ? `/#/member/tutorials/${targetProdId}` : null,
                        downloadUrl: downloadUrl
                    }
                ];
            }

            let licenseToken = '';
            if (isPaid) {
                const activation = await prisma.token_device_activation.findFirst({
                    where: { order_id: order.id }
                });
                if (activation) {
                    licenseToken = activation.token;
                }
            }

            const createdDateStr = new Date(order.created * 1000).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            const paidDateStr = order.paid_at ? new Date(order.paid_at * 1000).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            }) : undefined;

            let discountAmount = 0;
            let voucherCode = '';
            try {
                if (order.voucer && order.voucer.trim().startsWith('{')) {
                    const voucerParsed = JSON.parse(order.voucer);
                    if (voucerParsed && typeof voucerParsed === 'object') {
                        voucherCode = voucerParsed.code || 'Diskon';
                        const decrease = Number(voucerParsed.decrease_value) || 0;
                        if (decrease > 0) {
                            if (voucerParsed.voucer_type === '%') {
                                discountAmount = subtotal * (decrease / 100);
                            } else {
                                discountAmount = decrease;
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore parsing errors for voucher
            }

            const totalAmountStr = (order.total_amount || 0) + (order.admin_fee || 0);
            const netProductPrice = Math.max(0, subtotal - discountAmount);
            const rawUniqueCode = (order.total_amount || 0) - netProductPrice;
            const uniqueCode = rawUniqueCode > 0 ? rawUniqueCode : 0;

            // Lookup user profile
            const userProfile = await prisma.user.findFirst({
                where: { email: order.user }
            });

            return res.json({
                status: 'success',
                data: {
                    token: order.invoice_token,
                    orderId: order.id,
                    invoiceNumber: `INV-${order.id}`,
                    created: order.created,
                    createdDateStr,
                    paidDateStr,
                    status: order.status,
                    isPaid,
                    customer: {
                        email: order.user,
                        name: userProfile?.name || order.user.split('@')[0],
                        whatsapp: userProfile?.whatsapp || null,
                        company: userProfile?.company || null
                    },
                    items: itemsFinal,
                    pricing: {
                        subtotal: subtotal,
                        adminFee: order.admin_fee || 0,
                        discount: discountAmount,
                        voucherCode: voucherCode,
                        uniqueCode: uniqueCode,
                        totalAmount: totalAmountStr
                    },
                    paymentUrl: order.payment_url,
                    qrImage: order.qr_string || null,
                    licenseToken
                }
            });
        } catch (error) {
            console.error('Failed to get invoice data:', error);
            return res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }

    async getInvoicePdfStream(req: Request, res: Response) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        const token = String(req.params.token || '');
        const isDownload = req.query.download === 'true' || req.path.endsWith('/download');

        try {
            const order = await prisma.order_list.findFirst({
                where: { invoice_token: token }
            });

            if (!order) {
                return res.status(404).send('Invoice not found');
            }

            let itemsParsed: any = null;
            try {
                itemsParsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            } catch (e) {
                itemsParsed = null;
            }

            const isPaid = order.status === 'Order has been complete' || order.status === 'COMPLETED';

            // Resolve all products to map product tutorials and download hub query links
            const allProducts = await prisma.products.findMany({
                select: { id: true, name: true, tutorials: true, installer_files: true, product_id: true }
            });
            const productByIdMap = new Map<number, typeof allProducts[0]>();
            const productByNameMap = new Map<string, typeof allProducts[0]>();
            allProducts.forEach(p => {
                productByIdMap.set(p.id, p);
                if (p.product_id) productByIdMap.set(p.product_id, p);
                if (p.name) productByNameMap.set(p.name.trim().toLowerCase(), p);
            });

            const getProductMatch = (item: any) => {
                const dbId = Number(item?.db_id || item?.id || 0);
                const prodId = Number(item?.product_id || 0);
                const nameKey = (item?.name || item?.product_name || '').trim().toLowerCase();
                return productByIdMap.get(dbId) || productByIdMap.get(prodId) || productByNameMap.get(nameKey) || null;
            };

            const parseProductHasTutorials = (prod: typeof allProducts[0] | null): boolean => {
                if (!prod?.tutorials) return false;
                try {
                    const parsed = typeof prod.tutorials === 'string' ? JSON.parse(prod.tutorials) : prod.tutorials;
                    return Array.isArray(parsed) && parsed.length > 0;
                } catch {
                    return false;
                }
            };

            // Derive host base URL for absolute links inside PDF
            const hostHeader = req.get('host') || 'appcenter.ziqva.com';
            const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
            const baseUrl = `${protocol}://${hostHeader}`;

            let itemsFinal: any[] = [];
            let subtotal = 0;
            const fallbackDurationMonths = Math.round(order.duration / 43800) || 1;

            if (Array.isArray(itemsParsed) && itemsParsed.length > 0) {
                itemsFinal = itemsParsed.map(item => {
                    const durMonths = item.duration_months || fallbackDurationMonths;
                    let price = item.final_unit_price || item.price || 0;
                    if (item.final_unit_price && durMonths > 1) {
                        price = item.final_unit_price * durMonths;
                    } else if (item.price && durMonths > 1 && item.price === item.final_unit_price) {
                        price = item.price * durMonths;
                    }

                    subtotal += price;
                    let durStr = item.duration_text || item.duration;
                    if (!durStr && item.duration_months) durStr = `${item.duration_months} Bulan`;
                    if (!durStr) durStr = `${fallbackDurationMonths} Bulan`;

                    const matchedProd = getProductMatch(item);
                    const hasTutorials = parseProductHasTutorials(matchedProd);
                    const productName = item.name || item.product_name || matchedProd?.name || 'Software Subscription';
                    const targetProdId = matchedProd ? matchedProd.id : (item.db_id || item.id || null);

                    const downloadUrl = targetProdId
                        ? `${baseUrl}/#/member/downloads?id=${targetProdId}&search=${encodeURIComponent(productName)}`
                        : `${baseUrl}/#/member/downloads?search=${encodeURIComponent(productName)}`;

                    return {
                        name: productName,
                        duration: durStr,
                        price: price,
                        hasTutorials: hasTutorials,
                        tutorialUrl: hasTutorials && targetProdId ? `${baseUrl}/#/member/tutorials/${targetProdId}` : undefined,
                        downloadUrl: downloadUrl
                    };
                });
            } else {
                subtotal = order.total_amount || 0;
                const matchedProd = getProductMatch(itemsParsed);
                const hasTutorials = parseProductHasTutorials(matchedProd);
                const productName = itemsParsed?.name || itemsParsed?.product_name || matchedProd?.name || 'Software Subscription';
                const targetProdId = matchedProd ? matchedProd.id : null;

                const downloadUrl = targetProdId
                    ? `${baseUrl}/#/member/downloads?id=${targetProdId}&search=${encodeURIComponent(productName)}`
                    : `${baseUrl}/#/member/downloads?search=${encodeURIComponent(productName)}`;

                itemsFinal = [
                    {
                        name: productName,
                        duration: `${fallbackDurationMonths} Bulan`,
                        price: subtotal,
                        hasTutorials: hasTutorials,
                        tutorialUrl: hasTutorials && targetProdId ? `${baseUrl}/#/member/tutorials/${targetProdId}` : undefined,
                        downloadUrl: downloadUrl
                    }
                ];
            }

            let discountAmount = 0;
            let voucherCode = '';
            try {
                if (order.voucer && order.voucer.trim().startsWith('{')) {
                    const voucerParsed = JSON.parse(order.voucer);
                    if (voucerParsed && typeof voucerParsed === 'object') {
                        voucherCode = voucerParsed.code || 'Diskon';
                        const decrease = Number(voucerParsed.decrease_value) || 0;
                        if (decrease > 0) {
                            if (voucerParsed.voucer_type === '%') {
                                discountAmount = subtotal * (decrease / 100);
                            } else {
                                discountAmount = decrease;
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore
            }

            let licenseToken = undefined;
            if (isPaid) {
                const activation = await prisma.token_device_activation.findFirst({
                    where: { order_id: order.id }
                });
                if (activation) {
                    licenseToken = activation.token;
                }
            }

            // Fetch user profile for phone & company details
            const userProfile = await prisma.user.findFirst({
                where: { email: order.user }
            });

            const customerName = userProfile?.name || order.user.split('@')[0];
            const customerPhone = userProfile?.whatsapp || undefined;
            const customerCompany = userProfile?.company || undefined;

            // Determine Expiry Date based on GoQRIS settings or fallback to 24 hours
            const goqrisSettings = await prisma.payment_settings.findFirst({
                where: { gateway_name: 'goqris' }
            });
            const expiryMinutes = goqrisSettings?.expiry_minutes || 1440; // Default 24 hours
            const expiryTimestamp = order.created + (expiryMinutes * 60);

            const tz = (req.query.tz as string) || 'Asia/Jakarta';

            const formatCleanDateTime = (sec: number, timezone: string) => {
                try {
                    const d = new Date(sec * 1000);
                    // Format standard Indonesian date
                    const day = d.toLocaleDateString('id-ID', { timeZone: timezone, day: 'numeric' });
                    const month = d.toLocaleDateString('id-ID', { timeZone: timezone, month: 'short' });
                    const year = d.toLocaleDateString('id-ID', { timeZone: timezone, year: 'numeric' });
                    const time = d.toLocaleTimeString('id-ID', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
                    
                    // Simple timezone abbreviation
                    let tzAbbr = 'WIB';
                    if (timezone.includes('Makassar') || timezone.includes('Ujung_Pandang') || timezone.includes('Bali') || timezone.includes('WITA')) {
                        tzAbbr = 'WITA';
                    } else if (timezone.includes('Jayapura') || timezone.includes('WIT')) {
                        tzAbbr = 'WIT';
                    } else if (timezone !== 'Asia/Jakarta') {
                        tzAbbr = timezone.split('/').pop()?.replace('_', ' ') || timezone;
                    }

                    return `${day} ${month} ${year}, ${time} ${tzAbbr}`;
                } catch (e) {
                    return new Date(sec * 1000).toLocaleDateString('id-ID');
                }
            };
            
            const totalAmountStr = (order.total_amount || 0) + (order.admin_fee || 0);
            const netProductPrice = Math.max(0, subtotal - discountAmount);
            const rawUniqueCode = (order.total_amount || 0) - netProductPrice;
            const uniqueCode = rawUniqueCode > 0 ? rawUniqueCode : 0;

            const invoicePdfData: InvoicePdfData = {
                invoiceNumber: `INV-${order.id}`,
                createdDate: formatCleanDateTime(order.created, tz),
                expiredDate: formatCleanDateTime(expiryTimestamp, tz),
                paidDate: order.paid_at ? formatCleanDateTime(order.paid_at, tz) : undefined,
                status: order.status,
                isPaid,
                customerName,
                customerEmail: order.user,
                customerPhone,
                customerCompany,
                items: itemsFinal,
                subtotal: subtotal,
                adminFee: order.admin_fee || 0,
                discount: discountAmount,
                voucherCode: voucherCode,
                uniqueCode: uniqueCode,
                totalAmount: totalAmountStr,
                licenseToken
            };

            const pdfBuffer = await generateInvoicePdfBuffer(invoicePdfData);
            const filename = `Invoice-INV-${order.id}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            if (isDownload) {
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            } else {
                res.setHeader('Content-Disposition', 'inline');
            }
            return res.send(pdfBuffer);
        } catch (error) {
            console.error('Failed to stream invoice PDF:', error);
            return res.status(500).send('Error generating PDF');
        }
    }

    async getMemberInvoices(req: Request, res: Response) {
        const session = req.session as any;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const searchQuery = ((req.query.search as string) || '').trim().toLowerCase();
        const statusFilter = ((req.query.status as string) || 'all').trim().toLowerCase();
        const sortBy = ((req.query.sort as string) || 'created').trim().toLowerCase();
        const sortOrder = ((req.query.order as string) || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));

        try {
            const rawOrders = await prisma.order_list.findMany({
                where: {
                    OR: [
                        { user: userEmail },
                        { user: userEmail.toLowerCase() }
                    ]
                },
                orderBy: { id: 'desc' }
            });

            // Fetch products for product name, image, and description resolution
            const allProducts = await prisma.products.findMany({
                select: { id: true, name: true, image: true, description: true, product_id: true }
            });

            const productMap = new Map<number, typeof allProducts[0]>();
            const productNameMap = new Map<string, typeof allProducts[0]>();
            allProducts.forEach(p => {
                productMap.set(p.id, p);
                if (p.product_id) productMap.set(p.product_id, p);
                if (p.name) productNameMap.set(p.name.trim().toLowerCase(), p);
            });

            let paidCount = 0;
            let pendingCount = 0;

            const mappedInvoices = await Promise.all(rawOrders.map(async (order) => {
                const token = await ensureOrderInvoiceToken(order.id);
                const isPaid = order.status === 'Order has been complete' || order.status === 'COMPLETED';

                if (isPaid) paidCount++;
                else pendingCount++;

                let productName = 'Software Subscription';
                let productImage = '';
                let productDescription = '';
                let productId = 0;

                try {
                    const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const firstItem = parsed[0];
                        productName = firstItem.name || productName;
                        productId = firstItem.id || firstItem.product_id || 0;
                        productImage = firstItem.image || '';
                        productDescription = firstItem.description || '';
                    } else if (parsed && typeof parsed === 'object') {
                        productName = parsed.name || parsed.product_name || productName;
                        productId = parsed.id || parsed.product_id || 0;
                        productImage = parsed.image || '';
                        productDescription = parsed.description || '';
                    }
                } catch (e) {
                    /* ignore */
                }

                // If image or description not found in item json, resolve from products table
                const matchedProduct = productMap.get(productId) || productNameMap.get(productName.trim().toLowerCase());
                if (matchedProduct) {
                    if (!productImage && matchedProduct.image) productImage = matchedProduct.image;
                    if (!productDescription && matchedProduct.description) {
                        productDescription = matchedProduct.description;
                    }
                }

                // Clean html tags from description if any
                const cleanDescription = (productDescription || '')
                    .replace(/<[^>]*>?/gm, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                return {
                    id: order.id,
                    invoiceNumber: `INV-${order.id}`,
                    token,
                    productName,
                    productImage,
                    productDescription: cleanDescription,
                    created: order.created,
                    createdDateStr: new Date(order.created * 1000).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    }),
                    status: order.status,
                    isPaid,
                    statusCategory: isPaid ? 'paid' : 'pending',
                    totalAmount: (order.total_amount || 0) + (order.admin_fee || 0)
                };
            }));

            // Filter search
            let filtered = searchQuery
                ? mappedInvoices.filter(inv =>
                    inv.invoiceNumber.toLowerCase().includes(searchQuery) ||
                    inv.productName.toLowerCase().includes(searchQuery) ||
                    inv.createdDateStr.toLowerCase().includes(searchQuery)
                )
                : mappedInvoices;

            // Filter status
            if (statusFilter !== 'all') {
                filtered = filtered.filter(inv => inv.statusCategory === statusFilter);
            }

            // Sort
            filtered.sort((a, b) => {
                let comp = 0;
                if (sortBy === 'total' || sortBy === 'amount') {
                    comp = a.totalAmount - b.totalAmount;
                } else {
                    comp = a.created - b.created;
                }
                return sortOrder === 'asc' ? comp : -comp;
            });

            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            const safePage = Math.min(page, totalPages);
            const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

            return res.json({
                status: 'success',
                data: {
                    invoices: paginated,
                    pagination: {
                        page: safePage,
                        pageSize,
                        totalItems,
                        totalPages
                    },
                    counts: {
                        all: mappedInvoices.length,
                        paid: paidCount,
                        pending: pendingCount
                    }
                }
            });
        } catch (error) {
            console.error('Failed to get member invoices:', error);
            return res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
}

export const invoiceController = new InvoiceController();
