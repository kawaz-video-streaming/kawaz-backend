import { AmqpClient } from '@ido_kawaz/amqp-client';
import { BadRequestError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { promises } from 'fs';
import { StatusCodes } from "http-status-codes";
import { isNil } from 'ramda';
import { MediaDal } from '../../dal/media';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createMediaLogic } from './logic';

export const createMediaHandlers = (mediaDal: MediaDal, storageClient: StorageClient, amqpClient: AmqpClient) => {
    const logic = createMediaLogic(mediaDal, storageClient, amqpClient);
    return {
        uploadMedia:
            requestHandlerDecorator(
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