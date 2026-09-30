export interface PaymentRecord {
    id: number;
    user: string;
    email: string;
    productName: string;
    totalAmount: number;
    adminFee: number;
    channelCode: string | null;
    status: string;
    paymentRequestId: string | null;
    vaNumber: string | null;
    paidAt: string | null;
    createdAt: string;
    expiresAt: string | null;
}

export interface PaymentsListData {
    adminName: string;
    payments: PaymentRecord[];
    totalPayments: number;
    page: number;
    totalPages: number;
    search: string;
    sort: string;
    order: string;
}
