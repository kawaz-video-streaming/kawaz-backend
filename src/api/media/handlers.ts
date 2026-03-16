import { AmqpClient } from '@ido_kawaz/amqp-client';
import { Request, Response } from "@ido_kawaz/server-framework";
import { StatusCodes } from "http-status-codes";
import { MediaDal } from '../../dal/media';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createMediaLogic } from './logic';
import { validateMediaUploadRequest } from './types';

export const createMediaHandlers = (mediaDal: MediaDal, amqpClient: AmqpClient) => {
    const logic = createMediaLogic(mediaDal, amqpClient);
    return {
        uploadMedia:
            requestHandlerDecorator(
                'upload media',
                async (rawReq: Request, res: Response) => {
                    const { file } = validateMediaUploadRequest(rawReq);
                    await logic.uploadMedia(file);
                    res.status(StatusCodes.OK).json({ message: 'Media Started Uploading' });
                })
    };
}