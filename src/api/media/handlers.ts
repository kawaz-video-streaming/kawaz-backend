import { AmqpClient } from '@ido_kawaz/amqp-client';
import { Request, Response } from "@ido_kawaz/server-framework";
import { VodClient, VideoNotFoundError, NoVideosFoundError } from "@ido_kawaz/vod-client";
import { StatusCodes } from "http-status-codes";
import { MediaDal } from '../../dal/media';
import { requestHandlerDecorator } from "../../utils/decorator";
import { createMediaLogic } from './logic';
import { validateMediaUploadRequest } from './types';

export const createMediaHandlers = (mediaDal: MediaDal, amqpClient: AmqpClient, vodClient: VodClient) => {
    const logic = createMediaLogic(mediaDal, amqpClient, vodClient);
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
                    const videoId = req.params[0] as string;
                    const manifestStream = await logic.getManifest(videoId);
                    res.setHeader("Content-Type", "application/dash+xml");
                    manifestStream.pipe(res);
                }),
        getSegmentUrl:
            requestHandlerDecorator(
                'get video segment url',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0] as string;
                    const filename = req.params[1] as string;
                    const url = await logic.getSegmentUrl(videoId, filename);
                    res.redirect(url);
                }),
        getVtt:
            requestHandlerDecorator(
                'get video vtt',
                async (req: Request, res: Response) => {
                    const videoId = req.params[0] as string;
                    const filename = req.params[1] as string;
                    const vttStream = await logic.getVtt(videoId, filename);
                    res.setHeader("Content-Type", "text/vtt");
                    vttStream.pipe(res);
                }),
    }
};