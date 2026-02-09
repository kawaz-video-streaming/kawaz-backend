import { Request, Response } from 'express';
import { MediaDal } from '../../models/media/media.dal';
import { StorageClient } from '../../services/storageClient/storageClient';
import { createMediaLogic } from './media.logic';
import { StatusCodes } from "http-status-codes";
import { isNil } from 'ramda';

export const createMediaHandlers = (mediaDal: MediaDal, storageClient: StorageClient) => {
    const logic = createMediaLogic(mediaDal, storageClient);
    return {
        uploadMedia: async (req: Request, res: Response) => {
            try {
                if (isNil(req.file)) {
                    res.status(StatusCodes.BAD_REQUEST).json({ error: 'No file uploaded' });
                    return;
                }
                await logic.uploadMedia(req.file);
                res.status(StatusCodes.CREATED).json({ message: 'Media uploaded successfully' });
            } catch (error) {
                res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to upload media' });
            }
        }
    };
}