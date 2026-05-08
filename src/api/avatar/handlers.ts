import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from 'ramda';
import { AvatarCategoryDal } from "../../dal/avatarCategory";
import { requestHandlerDecorator } from "../../utils/decorator";
import { BucketsConfig } from "../../utils/types";
import { validateRequestWithId } from "../../utils/zod";
import { createAvatarLogic } from "./logic";
import { AvatarAuthenticatedRequest } from "../types";
import { validateAvatarCreationRequest } from "./types";

export const createAvatarHandlers = (bucketsConfig: BucketsConfig, avatarCategoryDal: AvatarCategoryDal, storageClient: StorageClient) => {
    const logicFactory = createAvatarLogic(bucketsConfig, avatarCategoryDal, storageClient);
    return {
        getAllAvatars:
            requestHandlerDecorator(
                'get all avatars',
                async (req: Request, res: Response) => {
                    const avatarDal = (req as AvatarAuthenticatedRequest).avatarDal;
                    const avatars = await logicFactory(avatarDal).getAllAvatars();
                    if (isEmpty(avatars)) {
                        throw new NotFoundError('No avatars found');
                    }
                    res.status(StatusCodes.OK).json(avatars);
                }),
        createAvatar:
            requestHandlerDecorator(
                'create avatar',
                async (rawReq: Request, res: Response) => {
                    const avatarDal = (rawReq as AvatarAuthenticatedRequest).avatarDal;
                    const { body, avatarImage } = validateAvatarCreationRequest(rawReq);
                    await logicFactory(avatarDal).createAvatar(body, avatarImage);
                    res.status(StatusCodes.OK).json({ message: 'Avatar created' });
                }),
        deleteAvatar:
            requestHandlerDecorator(
                'delete avatar',
                async (req: Request, res: Response) => {
                    const avatarDal = (req as AvatarAuthenticatedRequest).avatarDal;
                    const { params: { id: avatarId } } = validateRequestWithId(req);
                    await logicFactory(avatarDal).deleteAvatar(avatarId);
                    res.status(StatusCodes.OK).json({ message: 'Avatar deleted' });
                }),
        getAvatar:
            requestHandlerDecorator(
                'get avatar',
                async (req: Request, res: Response) => {
                    const avatarDal = (req as AvatarAuthenticatedRequest).avatarDal;
                    const { params: { id: avatarId } } = validateRequestWithId(req);
                    const avatar = await logicFactory(avatarDal).getAvatar(avatarId);
                    if (isNil(avatar)) {
                        throw new NotFoundError('Avatar not found');
                    }
                    res.status(StatusCodes.OK).json(avatar);
                }),
        getImage:
            requestHandlerDecorator(
                'get avatar image',
                async (req: Request, res: Response) => {
                    const avatarDal = (req as AvatarAuthenticatedRequest).avatarDal;
                    const { params: { id: avatarId } } = validateRequestWithId(req);
                    const image = await logicFactory(avatarDal).getAvatarImage(avatarId);
                    res.setHeader("Content-Type", "image/jpeg");
                    res.setHeader('Cache-Control', 'public, max-age=172800');
                    res.on('close', () => image.destroy());
                    image.pipe(res);
                })
    };
};