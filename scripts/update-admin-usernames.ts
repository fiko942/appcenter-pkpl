import prisma from '../src/config/prisma';

async function run() {
    console.log('Updating Admin ID 6 ("Pak Effand" -> "Effands")...');
    const u6 = await prisma.admin.update({
        where: { id: 6 },
        data: { username: 'Effands' }
    });
    console.log(`Updated Admin ID 6 to: ${u6.username}`);

    console.log('Updating Admin ID 2 ("Wiji Fiko Teren" -> "fiko942")...');
    const u2 = await prisma.admin.update({
        where: { id: 2 },
        data: { username: 'fiko942' }
    });
    console.log(`Updated Admin ID 2 to: ${u2.username}`);

    console.log('All admin usernames successfully updated in database.');
    await prisma.$disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
