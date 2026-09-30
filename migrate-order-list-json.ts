import dotenv from 'dotenv';
dotenv.config();

import prisma from './src/config/prisma';

const DECRYPT_API_URL = 'http://test.streampeg.com/index.php/';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1000;
const PARALLEL_THREADS = 20;
const BATCH_DELAY_MS = 500;

interface DecryptResponse {
    decoded_text: string;
}

async function decrypt(encryptedText: string, retries = 0): Promise<string> {
    try {
        const response = await fetch(DECRYPT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `text=${encodeURIComponent(encryptedText)}`,
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json() as DecryptResponse;
        return data.decoded_text;
    } catch (error) {
        if (retries < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS);
            return decrypt(encryptedText, retries + 1);
        }
        throw error;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    return value.length > 50 && /^[0-9a-fA-F]+/.test(value);
}

// Stats
let processed = 0;
let decrypted = 0;
let skipped = 0;
let errors = 0;
let total = 0;

function resetStats() {
    processed = 0;
    decrypted = 0;
    skipped = 0;
    errors = 0;
    total = 0;
}

function updateProgress(): void {
    const progress = ((processed / total) * 100).toFixed(1);
    process.stdout.write(`\r[${progress}%] ${processed}/${total} | ✅ Decrypted: ${decrypted} | ⏭️ Skipped: ${skipped} | ❌ Errors: ${errors}     `);
}

// ========== ORDER_LIST ITEMS JSON ==========
interface OrderListRecord {
    id: number;
    items: string;
}

interface ItemJson {
    id?: string;
    name?: string;
    image?: string;
    product_id?: string;
    description?: string;
    price?: string;
    is_discount?: string;
    discount_percent?: string;
    [key: string]: string | undefined;
}

async function processRecord(record: OrderListRecord): Promise<void> {
    try {
        // Parse items JSON
        let itemsData: ItemJson | ItemJson[];
        try {
            itemsData = JSON.parse(record.items);
        } catch {
            // Not valid JSON, skip
            skipped++;
            processed++;
            return;
        }

        // Handle both single object and array of objects
        const itemsArray = Array.isArray(itemsData) ? itemsData : [itemsData];
        let updated = false;

        for (const item of itemsArray) {
            // Decrypt name
            if (isEncrypted(item.name)) {
                try {
                    item.name = await decrypt(item.name!);
                    updated = true;
                } catch (error: any) {
                    console.log(`\n❌ Error order_list ${record.id} (name): ${error.message}`);
                }
            }

            // Decrypt image
            if (isEncrypted(item.image)) {
                try {
                    item.image = await decrypt(item.image!);
                    updated = true;
                } catch (error: any) {
                    console.log(`\n❌ Error order_list ${record.id} (image): ${error.message}`);
                }
            }

            // Decrypt description
            if (isEncrypted(item.description)) {
                try {
                    item.description = await decrypt(item.description!);
                    updated = true;
                } catch (error: any) {
                    console.log(`\n❌ Error order_list ${record.id} (description): ${error.message}`);
                }
            }
        }

        if (updated) {
            // Convert back to JSON
            const updatedItems = Array.isArray(itemsData) ? JSON.stringify(itemsArray) : JSON.stringify(itemsArray[0]);

            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    await prisma.order_list.update({
                        where: { id: record.id },
                        data: { items: updatedItems },
                    });
                    decrypted++;
                    break;
                } catch (dbError: any) {
                    if (attempt < 4) {
                        console.log(`\n⚠️ DB retry ${attempt + 1}/5 for record ${record.id}`);
                        await sleep(2000 * (attempt + 1));
                    } else {
                        errors++;
                        console.log(`\n❌ DB Error record ${record.id}: ${dbError.message}`);
                    }
                }
            }
        } else {
            skipped++;
        }
    } catch (error: any) {
        errors++;
        console.log(`\n❌ Error processing ${record.id}: ${error.message}`);
    }

    processed++;
}

async function processBatch(records: OrderListRecord[]): Promise<void> {
    await Promise.all(records.map(r => processRecord(r)));
}

async function migrate() {
    console.log('📋 TABLE: order_list (items JSON: name, image, description)');
    console.log('─────────────────────────────────────────');

    console.log('📊 Fetching records...');
    const records = await prisma.order_list.findMany({
        select: {
            id: true,
            items: true,
        },
    });

    total = records.length;
    resetStats();
    total = records.length;

    console.log(`📊 Total records: ${total}`);
    console.log(`🚀 Parallel threads: ${PARALLEL_THREADS}`);
    console.log('🔄 Starting migration...\n');

    for (let i = 0; i < records.length; i += PARALLEL_THREADS) {
        const batch = records.slice(i, i + PARALLEL_THREADS);
        await processBatch(batch);
        updateProgress();
        await sleep(BATCH_DELAY_MS);
    }

    console.log('\n✅ order_list items JSON migration complete!\n');
    return { processed, decrypted, skipped, errors };
}

async function main() {
    console.log('===========================================');
    console.log('  Order List Items JSON Migration');
    console.log('===========================================\n');

    const stats = await migrate();

    console.log('===========================================');
    console.log('  Migration Complete!');
    console.log('===========================================');
    console.log('\n📋 Table: order_list (items JSON)');
    console.log(`   ✅ Processed: ${stats.processed}`);
    console.log(`   🔓 Decrypted: ${stats.decrypted}`);
    console.log(`   ⏭️  Skipped: ${stats.skipped}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log('===========================================\n');

    await prisma.$disconnect();
}

main().catch(async (error) => {
    console.error('\n\n❌ Migration failed:', error);
    await prisma.$disconnect();
    process.exit(1);
});
