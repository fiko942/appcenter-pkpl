import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import { CONFIG } from '../config';

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    interface AppError { stack?: string; message?: string; status?: number; }
    const error = err as AppError;

    if (error.stack) {
        console.error(error.stack);
    }

    const message = CONFIG.NODE_ENV === 'development' ? (error.message || 'Unknown Error') : 'Internal Server Error';
    const errorDetails = CONFIG.NODE_ENV === 'development' ? err : {};

    return errorResponse(res, message, error.status || 500, errorDetails);
};
