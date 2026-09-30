import dotenv from 'dotenv';
import path from 'path';

// Load .env file
// Try loading from multiple potential locations (prod/dist vs dev/src)
const result = dotenv.config();

if (result.error) {
    // Fallback: explicit path attempt if default lookup failed (e.g. nested structure)
    dotenv.config({ path: path.join(__dirname, '../../.env') }); // Dev fallback
    dotenv.config({ path: path.join(__dirname, '../.env') });    // Dist fallback
}

export const CONFIG = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL,
};

if (!CONFIG.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL is not set in environment variables.');
}
