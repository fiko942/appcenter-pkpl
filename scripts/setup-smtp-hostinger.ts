import prisma from '../src/config/prisma';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

async function main() {
    console.log('--- Setting up SMTP Hostinger ---');

    const host = process.env.SMTP_HOST || 'smtp.example.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const encryption = process.env.SMTP_ENCRYPTION || 'ssl';
    const secure = process.env.SMTP_SECURE === 'true';
    const username = process.env.SMTP_USER || 'mailer@example.com';
    const password = process.env.SMTP_PASS || 'your_smtp_password';
    const from_email = process.env.SMTP_FROM_EMAIL || 'mailer@example.com';
    const from_name = process.env.SMTP_FROM_NAME || 'AppCenter';
    const is_active = true;
    const require_auth = true;

    // 1. Update or create in Database (smtp_settings)
    const existing = await prisma.smtp_settings.findFirst({
        orderBy: { id: 'desc' },
    });

    let saved;
    if (existing) {
        saved = await prisma.smtp_settings.update({
            where: { id: existing.id },
            data: {
                host,
                port,
                secure,
                encryption,
                username,
                password,
                from_email,
                from_name,
                is_active,
                require_auth,
            }
        });
        console.log('Updated existing smtp_settings row:', saved.id);
    } else {
        saved = await prisma.smtp_settings.create({
            data: {
                host,
                port,
                secure,
                encryption,
                username,
                password,
                from_email,
                from_name,
                is_active,
                require_auth,
            }
        });
        console.log('Created new smtp_settings row:', saved.id);
    }

    // 2. Update .env file
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');

        const envVars: Record<string, string> = {
            SMTP_HOST: host,
            SMTP_PORT: String(port),
            SMTP_USER: username,
            SMTP_PASS: password,
            SMTP_FROM_EMAIL: from_email,
            SMTP_FROM_NAME: from_name,
            SMTP_ENCRYPTION: encryption,
            SMTP_SECURE: 'true',
            SMTP_IS_ACTIVE: 'true',
            MAIL_HOST: host,
            MAIL_PORT: String(port),
            MAIL_USER: username,
            MAIL_PASS: password,
            MAIL_FROM_ADDRESS: from_email,
            MAIL_FROM_NAME: from_name
        };

        for (const [k, v] of Object.entries(envVars)) {
            const regex = new RegExp(`^${k}=.*$`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${k}="${v}"`);
            } else {
                envContent += `\n${k}="${v}"`;
            }
        }

        fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
        console.log('.env file updated with SMTP & MAIL variables.');
    }

    // 3. Test SMTP handshake
    console.log('Testing SMTP connection handshake with smtp.hostinger.com:465...');
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user: username,
            pass: password,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    await transporter.verify();
    console.log('SUCCESS: SMTP connection verified successfully! Hostinger is ready to send emails.');
}

main()
    .catch((err) => {
        console.error('SMTP Setup Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
