import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import prisma from './src/config/prisma';

const KEY = 'K9_VoB8XExZ2z3jX90XIi7L';

// mcrypt has a specific way of handling keys that are shorter than required
// For RIJNDAEL_256 (AES-256), mcrypt pads keys with null bytes to 32 bytes
// But for RIJNDAEL_128 in CTR mode, it might use different handling

// Let's also check if the data could be from mcrypt_encrypt directly without CI3's formatting

async function mcryptDirectTest() {
    const users = await prisma.user.findMany({ take: 1 });
    const encrypted = users[0].email;

    console.log('=== Testing mcrypt Direct Format ===\n');
    console.log(`Key: ${KEY}`);
    console.log(`Key as hex: ${Buffer.from(KEY).toString('hex')}\n`);

    // mcrypt_encrypt with MCRYPT_RIJNDAEL_128 in CTR mode
    // Output format: just the ciphertext (IV might be prepended separately)

    // The encrypted string has format: [hex part] + [base64 part]
    // This is unusual for CI3. Let's analyze what this could be.

    // Possibility 1: The hex part IS already the decrypted/encoded form of something
    // Possibility 2: Two separate encryptions concatenated
    // Possibility 3: A custom encryption wrapper

    // Let's try mcrypt's key handling: pad to 32 bytes with zeros
    const mcryptKey = Buffer.alloc(32);
    Buffer.from(KEY).copy(mcryptKey);

    console.log(`mcrypt padded key: ${mcryptKey.toString('hex')}\n`);

    // Let's also try: maybe the key in config is itself base64 encoded?
    try {
        const decodedKey = Buffer.from(KEY, 'base64');
        console.log(`Key decoded as base64: ${decodedKey.toString('hex')} (${decodedKey.length} bytes)`);

        // Use this decoded key
        if (decodedKey.length >= 16) {
            // Try with this key
            const base64Data = encrypted.substring(64);
            const payload = Buffer.from(base64Data, 'base64');
            const iv = payload.slice(0, 16);
            const ciphertext = payload.slice(16);

            // Pad decoded key to 32 bytes
            const encKey = Buffer.alloc(32);
            decodedKey.copy(encKey);

            const decipher = crypto.createDecipheriv('aes-256-ctr', encKey, iv);
            const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            console.log(`Decrypted with base64-decoded key: ${decrypted.toString('utf8').substring(0, 50)}...`);

            if (decrypted.toString('utf8').includes('@')) {
                console.log(`\n✅ SUCCESS with base64-decoded key!`);
                console.log(`Full: ${decrypted.toString('utf8')}`);
            }
        }
    } catch (e) {
        console.log('Key is not valid base64');
    }

    // Try different cipher modes
    console.log('\n=== Testing different AES modes ===\n');

    const modes = ['aes-256-ctr', 'aes-256-cfb', 'aes-256-cfb8', 'aes-256-ofb', 'aes-128-ctr', 'aes-128-cfb'];
    const dataFormats = [
        { name: 'after 64 hex', data: encrypted.substring(64) },
        { name: 'after 128 hex', data: encrypted.substring(128) },
        { name: 'full string', data: encrypted },
    ];

    for (const fmt of dataFormats) {
        for (const mode of modes) {
            try {
                const payload = Buffer.from(fmt.data, 'base64');
                if (payload.length < 17) continue;

                const iv = payload.slice(0, 16);
                const ciphertext = payload.slice(16);

                const keyLen = mode.includes('128') ? 16 : 32;
                const encKey = Buffer.alloc(keyLen);
                Buffer.from(KEY).copy(encKey);

                const decipher = crypto.createDecipheriv(mode, encKey, iv);
                const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
                const result = decrypted.toString('utf8');

                if (/^[\x20-\x7E]+$/.test(result) && result.includes('@')) {
                    console.log(`✅ SUCCESS!`);
                    console.log(`  Format: ${fmt.name}`);
                    console.log(`  Mode: ${mode}`);
                    console.log(`  Decrypted: ${result}`);
                    await prisma.$disconnect();
                    return;
                }
            } catch { }
        }
    }

    // Last attempt: What if the entire string is just base64 and there's no HMAC?
    console.log('\n=== Testing without HMAC assumption ===\n');

    // The string has both hex-valid and non-hex chars, so it can't be pure hex
    // But it might be base64 of (IV + ciphertext)

    try {
        const fullPayload = Buffer.from(encrypted, 'base64');
        console.log(`Full as base64: ${fullPayload.length} bytes`);

        for (const ivSize of [16, 32]) {
            if (fullPayload.length <= ivSize) continue;

            const iv = fullPayload.slice(0, 16); // Always 16 for AES
            const ciphertext = fullPayload.slice(ivSize);

            for (const mode of modes) {
                try {
                    const keyLen = mode.includes('128') ? 16 : 32;
                    const encKey = Buffer.alloc(keyLen);
                    Buffer.from(KEY).copy(encKey);

                    const decipher = crypto.createDecipheriv(mode, encKey, iv);
                    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
                    const result = decrypted.toString('utf8');

                    if (/^[\x20-\x7E]+$/.test(result) && result.includes('@')) {
                        console.log(`✅ SUCCESS (full base64)!`);
                        console.log(`  IV offset in payload: ${ivSize}`);
                        console.log(`  Mode: ${mode}`);
                        console.log(`  Decrypted: ${result}`);
                        await prisma.$disconnect();
                        return;
                    }
                } catch { }
            }
        }
    } catch { }

    console.log('❌ All mcrypt direct tests failed');

    // Let's print what the first user email SHOULD look like to help debug
    console.log('\n=== User info for debugging ===');
    console.log(`User ID: ${users[0].id}`);
    console.log(`Original ID: ${users[0].original_id}`);

    await prisma.$disconnect();
}

mcryptDirectTest().catch(console.error);
