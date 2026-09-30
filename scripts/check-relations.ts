
import 'dotenv/config';
import { PrismaClient } from '../src/generated/client/client';

const prisma = new PrismaClient();

async function checkRelations() {
    console.log('Checking relationships between User, OrderList, Device, and Invoice...\n');

    try {
        // 1. Get recent Orders (take 5 to increase chance of finding relations)
        const orders = await prisma.order_list.findMany({
            orderBy: { created: 'desc' },
            take: 5
        });

        if (orders.length === 0) {
            console.log('No orders found.');
            return;
        }

        console.log(`Found ${orders.length} recent orders. Analyzing relations...`);

        for (const order of orders) {
            console.log(`\n--------------------------------------------------`);
            console.log(`[Order Analysis] ID: ${order.id}`);
            console.log(` - Created (Epoch): ${order.created}`);
            // Show raw user data but limit length
            console.log(` - Raw User Data: ${order.user.length > 50 ? order.user.substring(0, 50) + '...' : order.user}`);

            // Parse User Data from Order
            let orderUserEmail: string | null = null;
            try {
                const parsedUser = JSON.parse(order.user);
                if (typeof parsedUser === 'object' && parsedUser.email) {
                    orderUserEmail = parsedUser.email;
                    console.log(` - Format: JSON Object -> Email: ${orderUserEmail}`);
                } else if (typeof parsedUser === 'string') {
                    orderUserEmail = parsedUser;
                    console.log(` - Format: JSON String -> Email: ${orderUserEmail}`);
                }
            } catch (e) {
                // If json parse fails, assume string is email
                if (order.user.includes('@')) {
                    orderUserEmail = order.user;
                    console.log(` - Format: Plain Text Email: ${orderUserEmail}`);
                } else {
                    console.log(' - Format: Unknown/Unparseable');
                }
            }

            // 2. Check Relation: Order -> Device (via order_id)
            const device = await prisma.device.findFirst({
                where: { order_id: order.id }
            });

            if (device) {
                console.log(` \n [RELATION FOUND] Order -> Device`);
                console.log(`  - MATCH: device.order_id (${device.order_id}) === order_list.id (${order.id})`);
                console.log(`  - Device Email: ${device.email}`);
            } else {
                console.log(`  - Device: None linked to order_id ${order.id}`);
            }

            // 3. Check Relation: Order -> User (via email)
            if (orderUserEmail) {
                const user = await prisma.user.findFirst({
                    where: { email: orderUserEmail }
                });

                if (user) {
                    console.log(` \n [RELATION FOUND] Order -> User`);
                    console.log(`  - MATCH: user.email === order_list.user`);
                    console.log(`  - User ID: ${user.id} | Verified: ${user.verified}`);

                    // 4. Check Relation: User -> Invoice (via email)
                    const invoice = await prisma.invoice.findFirst({
                        where: { email: orderUserEmail }
                    });

                    if (invoice) {
                        console.log(` \n [RELATION FOUND] User -> Invoice`);
                        console.log(`  - MATCH: invoice.email === user.email`);
                        console.log(`  - Invoice ID: ${invoice.id}`);
                    } else {
                        console.log(`  - Invoice: None found for email ${orderUserEmail}`);
                    }

                } else {
                    console.log(`  - User: No exact email match in 'user' table for ${orderUserEmail}`);
                }
            }
        }

    } catch (error) {
        console.error('Error executing check:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRelations();
