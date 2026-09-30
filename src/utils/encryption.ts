/**
 * Encryption Utility
 * Uses external PHP service for decryption (CI3 mcrypt compatibility)
 */

const DECRYPT_API_URL = 'http://test.streampeg.com/index.php/';

/**
 * Decrypt an encrypted string using the PHP service
 * @param encryptedText The encrypted string from database
 * @returns The decrypted plaintext
 */
export async function decrypt(encryptedText: string): Promise<string> {
    try {
        const response = await fetch(DECRYPT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `text=${encodeURIComponent(encryptedText)}`,
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Decrypt API error: ${response.status}`);
        }

        const data = await response.json() as { decoded_text: string };
        return data.decoded_text;
    } catch (error) {
        console.error('Decryption failed:', error);
        throw error;
    }
}

/**
 * Encrypt a string using the PHP service
 * @param plainText The plaintext to encrypt
 * @returns The encrypted string
 */
export async function encrypt(_plainText: string): Promise<string> {
    // TODO: Implement encryption endpoint on PHP side
    // For now, throw an error
    await Promise.resolve(); // Satisfy require-await
    throw new Error('Encryption not implemented - need to add encrypt endpoint to PHP service');
}

// Test function
async function testDecryption() {
    const testCases = [
        'ccc5c98858e8aa8a188db2534803ebdf379841a802161337d09aa69db8446532639c74e012405e21b63fbbabca99f5788e665b94f503fdb5faf9c4d633e7275eam2Jklq6OiWFL16nmjxCxvd76md66xPRVZs2ZzvMUOKx+3w=',
        '6114a8adb56a6d932610dac5512a4ffba3cdbf355828757e469190f07e004af679974707de4fdfeaf1f7375c496b755d0fb68418d300accfb4bcf849800f1425MEzLvMsIvocbDjcPV/WIGX4rxWFroM5NykoLAoHO6TMJ',
    ];

    console.log('=== Testing Decryption ===\n');

    for (const encrypted of testCases) {
        try {
            const decrypted = await decrypt(encrypted);
            console.log(`Encrypted: ${encrypted.substring(0, 50)}...`);
            console.log(`Decrypted: ${decrypted}`);
            console.log();
        } catch (error) {
            console.error(`Failed to decrypt: ${String(error)}`);
        }
    }
}

// Run test if executed directly
if (require.main === module) {
    testDecryption().catch(err => console.error('Test failed:', err));
}
