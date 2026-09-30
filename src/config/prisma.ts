import { PrismaClient } from '../generated/client/client';
import { CONFIG } from './index';

const prisma = new PrismaClient({
    log: CONFIG.NODE_ENV === 'production'
        ? ['warn', 'error']
        : (process.env.DEBUG_PRISMA === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error']),
});

export default prisma;
