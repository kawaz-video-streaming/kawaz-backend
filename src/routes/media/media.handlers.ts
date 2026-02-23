import { Request, Response } from 'express';
import { StatusCodes } from "http-status-codes";
import { isNil } from 'ramda';
import { MediaDal } from '../../models/media/media.dal';
import { StorageClient } from "@ido_kawaz/storage-client";
import { RequestHandlerDecorator } from '../../utils/decorators';
import { BadRequestError } from '../../utils/errors';
import { createMediaLogic } from './media.logic';
import { AmqpClient } from '@ido_kawaz/amqp-client';
import { promises } from 'fs';

export const createMediaHandlers = (mediaDal: MediaDal, storageClient: StorageClient, amqpClient: AmqpClient) => {
    const logic = createMediaLogic(mediaDal, storageClient, amqpClient);
    return {
        uploadMedia:
            RequestHandlerDecorator(
                'upload media',
                async (req: Request, res: Response) => {
                    if (isNil(req.file)) {
                        throw new BadRequestError("file is required for uploading media");
                    }
                    try {
                        await logic.uploadMedia(req.file);
                    } finally {
                        await promises.unlink(req.file.path);
                    }
                    res.status(StatusCodes.CREATED).json({ message: 'Media uploaded successfully' });
                })
    };
}