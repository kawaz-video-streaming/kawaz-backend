import { Request, Response } from 'express';
// import { MediaDal } from '../../models/media/media.dal';
import { StorageClient } from '../../services/storageClient';
import { createMediaLogic } from './media.logic';

export const createMediaHandlers = (/*mediaDal: MediaDal,*/ storageClient: StorageClient) => {
    const logic = createMediaLogic(/*mediaDal,*/ storageClient);
    return {
        uploadMedia: async (req: Request, res: Response) => {
            try {
                if (!req.file) {
                    res.status(400).json({ error: 'No file uploaded' });
                    return;
                }
                await logic.uploadMedia(req.file);
                res.status(201).json({ message: 'Media uploaded successfully' });
            } catch (error) {
                res.status(500).json({ error: 'Failed to upload media' });
            }
        }
    };
}