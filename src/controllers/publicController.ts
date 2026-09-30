
import { Request, Response } from 'express';
import { downloadService } from '../services/downloadService';
import { publicDownloadsPage } from '../views/public-downloads';

export class PublicController {
    /**
     * Show Public Downloads
     */
    async showDownloads(req: Request, res: Response) {
        try {
            const files = await downloadService.getFiles();

            res.send(publicDownloadsPage({
                files: files
            }));
        } catch (error) {
            console.error('Error serving public downloads:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}

export const publicController = new PublicController();
