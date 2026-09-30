import { Response } from 'express';

export const successResponse = (res: Response, data: unknown, message = 'Success', code = 200) => {
    return res.status(code).json({
        status: 'success',
        message,
        data,
    });
};

export const errorResponse = (res: Response, message = 'Internal Server Error', code = 500, error: unknown = null) => {
    return res.status(code).json({
        status: 'error',
        message,
        ...(error && typeof error === 'object' ? { error } : {}),
    });
};
