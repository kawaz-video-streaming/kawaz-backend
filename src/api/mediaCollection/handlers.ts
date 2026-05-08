import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from 'ramda';
import { MediaGenreDal } from "../../dal/mediaGenre";
import { requestHandlerDecorator } from "../../utils/decorator";
import { BucketsConfig } from "../../utils/types";
import { validateRequestWithId } from "../../utils/zod";
import { createMediaCollectionLogic } from "./logic";
import { validateMediaCollectionCreationRequest, validateMediaCollectionUpdateRequest } from './types';
import { MediaAuthenticatedRequest } from "../media/types";

export const createMediaCollectionHandlers = (bucketsConfig: BucketsConfig, mediaGenreDal: MediaGenreDal, storageClient: StorageClient) => {
    const logicFactory = createMediaCollectionLogic(bucketsConfig, mediaGenreDal, storageClient);
    return {
        getAllMediaCollections:
            requestHandlerDecorator(
                'get all media collections',
                async (req: Request, res: Response) => {
                    const { mediaCollectionDal, mediaDal } = req as MediaAuthenticatedRequest;
                    const mediaCollections = await logicFactory(mediaCollectionDal, mediaDal).getAllMediaCollections();
                    if (isEmpty(mediaCollections)) {
                        throw new NotFoundError('No media collections found');
                    }
                    res.status(StatusCodes.OK).json(mediaCollections);
                }),
        createMediaCollection:
            requestHandlerDecorator(
                'create media collection',
                async (rawReq: Request, res: Response) => {
                    const { mediaCollectionDal, mediaDal } = rawReq as MediaAuthenticatedRequest;
                    const { body, thumbnail } = validateMediaCollectionCreationRequest(rawReq);
                    await logicFactory(mediaCollectionDal, mediaDal).createMediaCollection(body, thumbnail);
                    res.status(StatusCodes.OK).json({ message: 'Media collection created' });
                }),
        deleteMediaCollection:
            requestHandlerDecorator(
                'delete media collection',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaCollectionId } } = validateRequestWithId(req);
                    const { mediaCollectionDal, mediaDal } = req as MediaAuthenticatedRequest;
                    await logicFactory(mediaCollectionDal, mediaDal).deleteMediaCollection(mediaCollectionId);
                    res.status(StatusCodes.OK).json({ message: 'Media collection deleted' });
                }),
        updateMediaCollection:
            requestHandlerDecorator(
                'update media collection',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaCollectionId }, body, thumbnail } = validateMediaCollectionUpdateRequest(req);
                    const { mediaCollectionDal, mediaDal } = req as MediaAuthenticatedRequest;
                    await logicFactory(mediaCollectionDal, mediaDal).updateMediaCollection(mediaCollectionId, body, thumbnail);
                    res.status(StatusCodes.OK).json({ message: 'Media collection updated' });
                }),
        getMediaCollection:
            requestHandlerDecorator(
                'get media collection',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaCollectionId } } = validateRequestWithId(req);
                    const { mediaCollectionDal, mediaDal } = req as MediaAuthenticatedRequest;
                    const mediaCollection = await logicFactory(mediaCollectionDal, mediaDal).getMediaCollection(mediaCollectionId);
                    if (isNil(mediaCollection)) {
                        throw new NotFoundError('Media collection not found');
                    }
                    res.status(StatusCodes.OK).json(mediaCollection);
                }),
        getThumbnail:
            requestHandlerDecorator(
                'get media collection thumbnail',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaCollectionId } } = validateRequestWithId(req);
                    const { mediaCollectionDal, mediaDal } = req as MediaAuthenticatedRequest;
                    const thumbnail = await logicFactory(mediaCollectionDal, mediaDal).getThumbnail(mediaCollectionId);
                    res.setHeader("Content-Type", "image/jpeg");
                    res.setHeader('Cache-Control', 'public, max-age=172800');
                    res.on('close', () => thumbnail.destroy());
                    thumbnail.pipe(res);
                })
    };
};