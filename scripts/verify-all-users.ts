import prisma from '../src/config/prisma';

async function main() {
    console.log('--- Memulai proses update status verifikasi seluruh user ---');

    const beforeTotal = await prisma.user.count();
    const beforeUnverified = await prisma.user.count({ where: { verified: false } });
    const beforeVerified = await prisma.user.count({ where: { verified: true } });
    console.log(`Status sebelum update: Total = ${beforeTotal}, Terverifikasi = ${beforeVerified}, Belum Terverifikasi = ${beforeUnverified}`);

    // Update all users to verified: true
    const result = await prisma.user.updateMany({
        where: { verified: false },
        data: { verified: true }
    });
    console.log(`Jumlah user yang di-update ke status verified: ${result.count}`);

    // Update user_location table as well
    const locResult = await prisma.user_location.updateMany({
        where: { user_verified: { not: '1' } },
        data: { user_verified: '1' }
    });
    console.log(`Jumlah user_location yang diselaraskan: ${locResult.count}`);

    const afterTotal = await prisma.user.count();
    const afterVerified = await prisma.user.count({ where: { verified: true } });
    const afterUnverified = await prisma.user.count({ where: { verified: false } });
    console.log(`Status sesudah update: Total = ${afterTotal}, Terverifikasi = ${afterVerified}, Belum Terverifikasi = ${afterUnverified}`);

    if (afterUnverified === 0 && afterVerified === afterTotal) {
        console.log('SUCCESS: Seluruh user (100%) sekarang berstatus verified: true.');
    } else {
        console.error('WARNING: Masih ada user yang belum terverifikasi!');
    }
}

main()
    .catch((err) => {
        console.error('Error saat update user:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
