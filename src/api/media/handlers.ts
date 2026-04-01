import { AmqpClient } from '@ido_kawaz/amqp-client';
import { Request, Response } from "@ido_kawaz/server-framework";
import { StorageClient } from '@ido_kawaz/storage-client';
import { NoVideosFoundError, VideoNotFoundError } from "@ido_kawaz/vod-client";
import { StatusCodes } from "http-status-codes";
import { MediaDal } from '../../dal/media';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createMediaLogic } from './logic';
import { MediaConfig, validateMediaUploadRequest } from './types';

export const createMediaHandlers = (mediaConfig: MediaConfig, mediaDal: MediaDal, amqpClient: AmqpClient, storageClient: StorageClient) => {
    const logic = createMediaLogic(mediaConfig, mediaDal, amqpClient, storageClient);
    return {
        uploadMedia:
            requestHandlerDecorator(
                'upload media',
                async (rawReq: Request, res: Response) => {
                    const { file } = validateMediaUploadRequest(rawReq);
                    await logic.uploadMedia(file);
                    res.status(StatusCodes.OK).json({ message: 'Media Started Uploading' });
                }),
        getVideos:
            requestHandlerDecorator(
                'get videos',
                async (_req: Request, res: Response) => {
                    try {
                        const videos = await logic.getVideos();
                        res.status(StatusCodes.OK).json(videos);
                    } catch (err) {
                        if (err instanceof NoVideosFoundError) {
                            res.status(StatusCodes.NOT_FOUND).json({ error: err.message });
                            return;
                        }
                        throw err;
                    }
                }),
        getVideoById:
            requestHandlerDecorator(
                'get video by id',
                async (req: Request, res: Response) => {
                    try {
                        const video = await logic.getVideoById(req.params.id as string);
                        res.status(StatusCodes.OK).json(video);
                    } catch (err) {
                        if (err instanceof VideoNotFoundError) {
                            res.status(StatusCodes.NOT_FOUND).json({ error: err.message });
                            return;
                        }
                        throw err;
                    }
                }),
        getManifest:
            requestHandlerDecorator(
                'get video manifest',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0];
                    const manifestStream = await logic.getManifest(videoId);
                    res.setHeader("Content-Type", "application/dash+xml");
                    manifestStream.pipe(res);
                }),
        getSegment:
            requestHandlerDecorator(
                'get video segment',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0];
                    const filename = req.params[1];
                    const segmentPresignedUrl = await logic.getSegmentUrl(videoId, filename);
                    res.redirect(segmentPresignedUrl);
                }),
        getVtt:
            requestHandlerDecorator(
                'get video vtt',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0];
                    const filename = req.params[1];
                    const vttStream = await logic.getVtt(videoId, filename);
                    res.setHeader("Content-Type", "text/vtt");
                    vttStream.pipe(res);
                }),
    }
};