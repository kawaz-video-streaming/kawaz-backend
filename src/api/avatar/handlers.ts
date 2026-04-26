import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from 'ramda';
import { AvatarDal } from "../../dal/avatar";
import { requestHandlerDecorator } from "../../utils/decorator";
import { BucketsConfig } from "../../utils/types";
import { validateRequestWithId } from "../../utils/zod";
import { createAvatarLogic } from "./logic";
import { validateAvatarCreationRequest } from "./types";
// import { createMediaCollectionLogic } from "./logic";
// import { validateMediaCollectionCreationRequest, validateMediaCollectionUpdateRequest } from './types';

export const createAvatarHandlers = (bucketsConfig: BucketsConfig, avatarDal: AvatarDal, storageClient: StorageClient) => {
    const logic = createAvatarLogic(bucketsConfig, avatarDal, storageClient);
    return {
        getAllAvatars:
            requestHandlerDecorator(
                'get all avatars',
                async (_req: Request, res: Response) => {
                    const avatars = await logic.getAllAvatars();
                    if (isEmpty(avatars)) {
                        throw new NotFoundError('No avatars found');
                    }
                    res.status(StatusCodes.OK).json(avatars);
                }),
        createAvatar:
            requestHandlerDecorator(
                'create avatar',
                async (rawReq: Request, res: Response) => {
                    const { body, avatarImage } = validateAvatarCreationRequest(rawReq);
                    await logic.createAvatar(body, avatarImage);
                    res.status(StatusCodes.OK).json({ message: 'Avatar created' });
                }),
        deleteAvatar:
            requestHandlerDecorator(
                'delete avatar',
                async (req: Request, res: Response) => {
                    const { params: { id: avatarId } } = validateRequestWithId(req);
                    await logic.deleteAvatar(avatarId);
                    res.status(StatusCodes.OK).json({ message: 'Avatar deleted' });
                }),
        getAvatar:
            requestHandlerDecorator(
                'get avatar',
                async (req: Request, res: Response) => {
                    const { params: { id: avatarId } } = validateRequestWithId(req);
                    const avatar = await logic.getAvatar(avatarId);
                    if (isNil(avatar)) {
                        throw new NotFoundError('Avatar not found');
                    }
                    res.status(StatusCodes.OK).json(avatar);
                }),
        getImage:
            requestHandlerDecorator(
                'get avatar image',
                async (req: Request, res: Response) => {
                    const { params: { id: avatarId } } = validateRequestWithId(req);
                    const image = await logic.getAvatarImage(avatarId);
                    res.setHeader("Content-Type", "image/jpeg");
                    res.setHeader('Cache-Control', 'public, max-age=172800');
                    image.pipe(res);
                })
    };
};