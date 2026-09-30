
import 'dotenv/config';
import { PrismaClient } from '../src/generated/client/client';

const prisma = new PrismaClient();

async function checkLicenseData() {
    console.log('Checking Token Device Activation data...\n');

    try {
        // Get sample tokens
        const tokens = await prisma.token_device_activation.findMany({
            take: 5,
            orderBy: { created: 'desc' }
        });

        console.log(`Found ${tokens.length} tokens.`);

        for (const token of tokens) {
            console.log(`\n[Token ID: ${token.id}]`);
            console.log(` - Token: ${token.token}`);
            console.log(` - Order ID: ${token.order_id}`);
            console.log(` - Product: ${token.product}`);
            console.log(` - User: ${token.user}`);
            console.log(` - Taked: ${token.taked}`);

            // Try to find matching device
            const device = await prisma.device.findFirst({
                where: {
                    order_id: token.order_id,
                    product: token.product
                }
            });

            if (device) {
                console.log(` => MATCHING DEVICE FOUND: ID ${device.id}`);
                console.log(`    - Machine ID: ${device.machine_id}`);
                console.log(`    - Expired: ${device.expired}`);
                console.log(`    - Created: ${device.created}`);
            } else {
                console.log(` => NO MATCHING DEVICE FOUND (based on order_id & product)`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLicenseData();
