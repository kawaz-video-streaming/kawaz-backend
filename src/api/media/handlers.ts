import { AmqpClient } from '@ido_kawaz/amqp-client';
import { Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { promises } from 'fs';
import { StatusCodes } from "http-status-codes";
import { MediaDal } from '../../dal/media';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createMediaLogic } from './logic';
import { validateMediaUploadRequest } from './schema';

export const createMediaHandlers = (mediaDal: MediaDal, storageClient: StorageClient, amqpClient: AmqpClient, storagePartSize: number) => {
    const logic = createMediaLogic(mediaDal, storageClient, amqpClient, storagePartSize);
    return {
        uploadMedia:
            requestHandlerDecorator(
                'upload media',
                async (req: Request, res: Response) => {
                    const validatedRequest = validateMediaUploadRequest(req);
                    try {
                        await logic.uploadMedia(validatedRequest.file);
                    } finally {
                        await promises.unlink(validatedRequest.file.path);
                    }
                    res.status(StatusCodes.CREATED).json({ message: 'Media uploaded successfully' });
                })
    };
}