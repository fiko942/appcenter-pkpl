
import 'dotenv/config';
import prisma from '../src/config/prisma';

async function main() {
    console.log('Fetching sample affiliate payouts...');
    const samples = await prisma.affiliate_payouts.findMany({
        take: 10,
        orderBy: { created: 'desc' }
    });

    console.log('Found', samples.length, 'payout samples:');
    samples.forEach(s => {
        console.log({
            id: s.id,
            email: s.affiliate_email,
            amount: s.amount,
            created: new Date(s.created * 1000).toLocaleString(),
            note: s.note
        });
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
