import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/response';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const products = await prisma.products.findMany({
            take: 20, // Limit to 20 for simplicity
        });
        return successResponse(res, products, 'Products retrieved successfully');
    } catch (error) {
        next(error);
    }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const product = await prisma.products.findUnique({
            where: {
                id: Number(id),
            },
        });

        if (!product) {
            res.status(404).json({ status: 'error', message: 'Product not found' });
            return;
        }

        return successResponse(res, product, 'Product details');
    } catch (error) {
        next(error);
    }
};
