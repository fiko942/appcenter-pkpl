import prisma from '../src/config/prisma';

async function main() {
    const admin2 = await prisma.admin.findUnique({ where: { id: 2 } });
    const admin6 = await prisma.admin.findUnique({ where: { id: 6 } });

    console.log('Admin ID 2:', admin2?.username);
    console.log('Admin ID 6:', admin6?.username);

    if (admin2?.username !== 'fiko942' || admin6?.username !== 'Effands') {
        console.error('FAIL: Usernames not updated yet.');
        process.exit(1);
    }
    console.log('PASS: All target admin usernames verified.');
    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
