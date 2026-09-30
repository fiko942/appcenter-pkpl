import express, { Application, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-call
const MySQLStore = require('express-mysql-session')(session);
import { errorHandler } from './middlewares/errorHandler';
import { successResponse } from './utils/response';
import routes from './routes/index';
import deviceRoutes from './routes/deviceRoutes';
import adminRoutes from './routes/adminRoutes';
import memberRoutes from './routes/memberRoutes';
import paymentRoutes from './routes/paymentRoutes';
import oauthRoutes from './routes/oauthRoutes';

const app: Application = express();

// Enable trust proxy for reverse proxy environments (Nginx, PM2, Cloudflare)
app.set('trust proxy', true);

// Middlewares
app.use(helmet({
    contentSecurityPolicy: false, // Disable for inline scripts in admin panel
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    xDownloadOptions: false
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({
    verify: (req: any, _res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
app.use(express.static(path.join(process.cwd(), 'client_dist')));
app.use(express.static(path.join(__dirname, 'client_dist')));
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use(express.static(path.join(__dirname, '../dist/client_dist')));

// Parse DATABASE_URL for session store
function getSessionStoreOptions() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        try {
            const parsedUrl = new URL(dbUrl);
            return {
                host: parsedUrl.hostname || 'localhost',
                port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 3306,
                user: decodeURIComponent(parsedUrl.username) || 'root',
                password: decodeURIComponent(parsedUrl.password) || '',
                database: parsedUrl.pathname.replace(/^\//, '') || 'appcenter',
                connectionLimit: 5,
            };
        } catch {
            // fallback
        }
    }
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'appcenter',
        connectionLimit: 5,
    };
}

// Session middleware for admin & member panel
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const sessionStore = new MySQLStore(getSessionStoreOptions());

app.use(session({
    secret: process.env.SESSION_SECRET || 'ziqva-admin-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    store: sessionStore,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 hari
    },
}));

// Routes
app.get('/health', (req: Request, res: Response) => {
    return successResponse(res, { uptime: process.uptime() }, 'Server is healthy');
});

// Robots.txt to prevent indexing admin and member panels
app.get('/robots.txt', (req: Request, res: Response) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /admin/\nDisallow: /member/\nDisallow: /device/\nDisallow: /api/\nDisallow: /invoice/\nDisallow: /#/invoice/\nDisallow: /api/v1/invoice/\n');
});

import { publicController } from './controllers/publicController';

// Public Routes
app.get('/download', (req, res) => publicController.showDownloads(req, res));

import fs from 'fs';

// Serve Svelte SPA for root '/'
app.get('/', (req: Request, res: Response) => {
    const distPath = path.join(__dirname, '../client_dist/index.html');
    const localDistPath = path.join(__dirname, '../client/dist/index.html');
    if (fs.existsSync(distPath)) return res.sendFile(distPath);
    if (fs.existsSync(localDistPath)) return res.sendFile(localDistPath);
    return res.status(404).send('SPA index.html not found');
});

// Admin Panel Routes (HTML)
app.use('/admin', adminRoutes);

// Member Panel Routes
app.use('/member', memberRoutes);

// Payment Routes (Webhook & Redirect) - support both /payment and /api/payment
app.use('/payment', paymentRoutes);
app.use('/api/payment', paymentRoutes);

// OAuth 2.0 & SSO Routes
app.use('/oauth', oauthRoutes);
app.use('/api/v1/oauth', oauthRoutes);

// API Routes
app.use('/api/v1', routes);

// Standalone Routes (Matching Legacy Client)
app.use('/device', deviceRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found',
    });
});

// Global Error Handler
app.use(errorHandler);

export default app;
