import { NotFoundError, Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from "@ido_kawaz/storage-client";
import { StatusCodes } from "http-status-codes";
import { isEmpty, isNil } from 'ramda';
import { Dals } from "../../dal/types";
import { requestHandlerDecorator } from "../../utils/decorator";
import { BucketsConfig } from "../../utils/types";
import { validateRequestWithId } from "../../utils/zod";
import { createMediaCollectionLogic } from "./logic";
import { validateMediaCollectionCreationRequest, validateMediaCollectionUpdateRequest } from './types';

export const createMediaCollectionHandlers = (bucketsConfig: BucketsConfig, dals: Dals, storageClient: StorageClient) => {
    const logic = createMediaCollectionLogic(bucketsConfig, dals, storageClient);
    return {
        getAllMediaCollections:
            requestHandlerDecorator(
                'get all media collections',
                async (_req: Request, res: Response) => {
                    const mediaCollections = await logic.getAllMediaCollections();
                    if (isEmpty(mediaCollections)) {
                        throw new NotFoundError('No media collections found');
                    }
                    res.status(StatusCodes.OK).json(mediaCollections);
                }),
        createMediaCollection:
            requestHandlerDecorator(
                'create media collection',
                async (rawReq: Request, res: Response) => {
                    const { body, thumbnail } = validateMediaCollectionCreationRequest(rawReq);
                    await logic.createMediaCollection(body, thumbnail);
                    res.status(StatusCodes.OK).json({ message: 'Media collection created' });
                }),
        deleteMediaCollection:
            requestHandlerDecorator(
                'delete media collection',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaCollectionId } } = validateRequestWithId(req);
                    await logic.deleteMediaCollection(mediaCollectionId);
                    res.status(StatusCodes.OK).json({ message: 'Media collection deleted' });
                }),
        updateMediaCollection:
            requestHandlerDecorator(
                'update media collection',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaCollectionId }, body, thumbnail } = validateMediaCollectionUpdateRequest(req);
                    await logic.updateMediaCollection(mediaCollectionId, body, thumbnail);
                    res.status(StatusCodes.OK).json({ message: 'Media collection updated' });
                }),
        getMediaCollection:
            requestHandlerDecorator(
                'get media collection',
                async (req: Request, res: Response) => {
                    const { params: { id: mediaCollectionId } } = validateRequestWithId(req);
                    const mediaCollection = await logic.getMediaCollection(mediaCollectionId);
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
                    const thumbnail = await logic.getThumbnail(mediaCollectionId);
                    res.setHeader("Content-Type", "image/jpeg");
                    res.setHeader('Cache-Control', 'public, max-age=172800');
                    res.on('close', () => thumbnail.destroy());
                    thumbnail.pipe(res);
                })
    };
};