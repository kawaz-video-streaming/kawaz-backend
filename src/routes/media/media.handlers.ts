import { Request, Response } from 'express';
import { StatusCodes } from "http-status-codes";
import { isNil } from 'ramda';
import { MediaDal } from '../../models/media/media.dal';
import { StorageClient } from '../../services/storageClient/storageClient';
import { RequestHandlerDecorator } from '../../utils/decorators';
import { BadRequestError } from '../../utils/errors';
import { createMediaLogic } from './media.logic';

export const createMediaHandlers = (mediaDal: MediaDal, storageClient: StorageClient) => {
    const logic = createMediaLogic(mediaDal, storageClient);
    return {
        uploadMedia:
            RequestHandlerDecorator(
                'upload media',
                async (req: Request, res: Response) => {
                    if (isNil(req.file)) {
                        throw new BadRequestError("file is required for uploading media");
                    }
                    await logic.uploadMedia(req.file);
                    res.status(StatusCodes.CREATED).json({ message: 'Media uploaded successfully' });
                })
    };
}