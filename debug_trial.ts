
import prisma from './src/config/prisma';

async function main() {
    try {
        const trials = await prisma.trial.findMany({ take: 5 });
        console.log(JSON.stringify(trials, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();

