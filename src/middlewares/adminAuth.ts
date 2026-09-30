import { Request, Response, NextFunction } from 'express';

// Session interface
declare module 'express-session' {
    interface SessionData {
        adminId: number;
        adminName: string;
        isAuthenticated: boolean;
    }
}

export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.isAuthenticated) {
        return res.redirect('/admin/login');
    }
    next();
};

export const isAuthenticated = (req: Request): boolean => {
    return req.session && req.session.isAuthenticated === true;
};
