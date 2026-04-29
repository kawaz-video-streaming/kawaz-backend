import { AmqpClient } from '@ido_kawaz/amqp-client';
import type { Application } from '@ido_kawaz/server-framework';
import { ApiError } from '@ido_kawaz/server-framework';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { UserDal } from '../../../dal/user';
import { Dals } from '../../../dal/types';
import { createAuthMiddleware } from '../../middleware';
import { createMediaRouter } from '../index';

const parseCookies = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.cookies = {};
    const header = req.headers.cookie ?? '';
    for (const pair of header.split(';')) {
        const idx = pair.indexOf('=');
        if (idx > 0) req.cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
    next();
};

describe('POST /upload/initiate and POST /upload/complete routes', () => {
    const AUTH_CONFIG = { jwtSecret: 'media-test-secret', adminPromotionSecret: 'admin-secret' };

    let app: Application;
    let mediaDal: { createMedia: jest.Mock; getPendingMedia: jest.Mock; updateMedia: jest.Mock; };
    let userDal: { findUser: jest.Mock; };
    let amqpClient: { publish: jest.Mock; };
    let storageClient: { ensureBucket: jest.Mock; getPutPresignedUrl: jest.Mock; };
    let adminToken: string;

    beforeEach(() => {
        mediaDal = {
            createMedia: jest.fn().mockResolvedValue({
                _id: 'media-1',
                fileName: 'sample-upload.mp4',
                title: 'My Upload',
                genres: [],
                size: 1000,
                status: 'pending',
                percentage: 10,
                thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            }),
            getPendingMedia: jest.fn().mockResolvedValue({
                _id: 'media-1',
                fileName: 'sample-upload.mp4',
                status: 'pending',
            }),
            updateMedia: jest.fn().mockResolvedValue(undefined),
        };

        userDal = {
            findUser: jest.fn().mockResolvedValue({ name: 'admin', password: 'hash', role: 'admin' }),
        };

        amqpClient = {
            publish: jest.fn(),
        };

        storageClient = {
            ensureBucket: jest.fn().mockResolvedValue(undefined),
            getPutPresignedUrl: jest.fn().mockResolvedValue('https://presigned-url'),
        };

        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);

        app = express();
        app.use(express.json());
        app.use(parseCookies);
        app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
        app.use('/media', createMediaRouter({
            kawazPlus: { kawazStorageBucket: 'upload-bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
            vod: { vodStorageBucket: 'vod-bucket' },
        }, { mediaDal, mediaCollectionDal: {}, mediaGenreDal: { verifyGenreExists: jest.fn().mockResolvedValue(true) } } as unknown as Dals, amqpClient as unknown as AmqpClient, storageClient as any));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('POST /upload/initiate returns 200 with presigned URLs for valid request', async () => {
        const response = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ title: 'My Upload', kind: 'movie', fileName: 'sample-upload.mp4', fileSize: 1000, mimeType: 'video/mp4' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            mediaId: 'media-1',
            videoUploadUrl: 'https://presigned-url',
            thumbnailUploadUrl: 'https://presigned-url',
        });

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.createMedia).toHaveBeenCalledWith({
            title: 'My Upload',
            kind: 'movie',
            genres: [],
            thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            fileName: 'sample-upload.mp4',
            size: 1000,
        });

        expect(storageClient.ensureBucket).toHaveBeenCalledWith('upload-bucket');
        expect(storageClient.getPutPresignedUrl).toHaveBeenCalledTimes(2);
    });

    it('POST /upload/initiate returns 400 when required fields are missing', async () => {
        const response = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ title: 'My Upload' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid request');

        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('POST /upload/initiate returns 500 when DAL createMedia fails', async () => {
        mediaDal.createMedia.mockRejectedValueOnce(new Error('db failure'));

        const response = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ title: 'My Upload', kind: 'movie', fileName: 'sample-upload.mp4', fileSize: 1000, mimeType: 'video/mp4' });

        expect(response.status).toBe(500);
        expect(response.body.message).toContain('db failure');

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('POST /upload/complete returns 200 and publishes convert event when media is pending', async () => {
        const response = await request(app)
            .post('/media/upload/complete')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ mediaId: 'media-1' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Media processing started' });

        expect(mediaDal.getPendingMedia).toHaveBeenCalledWith('media-1');
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith(
            'convert',
            'convert.media',
            expect.objectContaining({
                mediaId: 'media-1',
                mediaFileName: 'sample-upload.mp4',
                mediaStorageBucket: 'upload-bucket',
            }),
        );
        expect(mediaDal.updateMedia).toHaveBeenCalledWith('media-1', { status: 'processing', percentage: 20 });
    });

    it('POST /upload/complete returns 404 when media not found or already processing', async () => {
        mediaDal.getPendingMedia.mockResolvedValueOnce(null);

        const response = await request(app)
            .post('/media/upload/complete')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ mediaId: 'media-1' });

        expect(response.status).toBe(404);
        expect(mediaDal.getPendingMedia).toHaveBeenCalledWith('media-1');
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });
});

describe('GET /media/uploading', () => {
    const AUTH_CONFIG = { jwtSecret: 'uploading-test-secret', adminPromotionSecret: 'admin-secret' };

    let app: Application;
    let mediaDal: { getAllNoneCompletedMedia: jest.Mock; };
    let userDal: { findUser: jest.Mock; };
    let userToken: string;

    const makeApp = () => {
        app = express();
        app.use(parseCookies);
        app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
        app.use('/media', createMediaRouter({
            kawazPlus: { kawazStorageBucket: 'bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
            vod: { vodStorageBucket: 'vod-bucket' },
        }, { mediaDal, mediaCollectionDal: {}, mediaGenreDal: { verifyGenreExists: jest.fn().mockResolvedValue(true) } } as unknown as Dals, {} as unknown as AmqpClient, {} as any));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    };

    beforeEach(() => {
        mediaDal = {
            getAllNoneCompletedMedia: jest.fn().mockResolvedValue([
                { _id: 'media-1', status: 'pending', percentage: 10 },
                { _id: 'media-2', status: 'processing', percentage: 20 },
            ]),
        };

        userDal = {
            findUser: jest.fn().mockResolvedValue({ name: 'user', password: 'hash', role: 'user' }),
        };

        userToken = jwt.sign({ username: 'user', role: 'user' }, AUTH_CONFIG.jwtSecret);
        makeApp();
    });

    it('returns 200 with all non-completed media', async () => {
        const response = await request(app)
            .get('/media/uploading')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expect(mediaDal.getAllNoneCompletedMedia).toHaveBeenCalledTimes(1);
    });

    it('returns 200 with empty array when there are no non-completed media', async () => {
        mediaDal.getAllNoneCompletedMedia.mockResolvedValueOnce([]);

        const response = await request(app)
            .get('/media/uploading')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('returns 401 when not authenticated', async () => {
        const response = await request(app).get('/media/uploading');

        expect(response.status).toBe(401);
    });
});

describe('GET /media/:id/progress', () => {
    const AUTH_CONFIG = { jwtSecret: 'progress-test-secret', adminPromotionSecret: 'admin-secret' };
    const mediaId = '507f1f77bcf86cd799439011';

    let app: Application;
    let mediaDal: { getMediaUploadProgress: jest.Mock; };
    let userDal: { findUser: jest.Mock; };
    let userToken: string;

    beforeEach(() => {
        mediaDal = {
            getMediaUploadProgress: jest.fn().mockResolvedValue({ status: 'processing', percentage: 50 }),
        };

        userDal = {
            findUser: jest.fn().mockResolvedValue({ name: 'user', password: 'hash', role: 'user' }),
        };

        userToken = jwt.sign({ username: 'user', role: 'user' }, AUTH_CONFIG.jwtSecret);

        app = express();
        app.use(parseCookies);
        app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
        app.use('/media', createMediaRouter({
            kawazPlus: { kawazStorageBucket: 'bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
            vod: { vodStorageBucket: 'vod-bucket' },
        }, { mediaDal, mediaCollectionDal: {}, mediaGenreDal: { verifyGenreExists: jest.fn().mockResolvedValue(true) } } as unknown as Dals, {} as unknown as AmqpClient, {} as any));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('returns 200 with status and percentage for an in-progress media', async () => {
        const response = await request(app)
            .get(`/media/${mediaId}/progress`)
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'processing', percentage: 50 });
        expect(mediaDal.getMediaUploadProgress).toHaveBeenCalledWith(mediaId);
    });

    it('returns 200 with percentage 100 for completed media', async () => {
        mediaDal.getMediaUploadProgress.mockResolvedValueOnce({ status: 'completed', percentage: 100 });

        const response = await request(app)
            .get(`/media/${mediaId}/progress`)
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'completed', percentage: 100 });
    });

    it('returns 200 with pending/0 when media is not yet found (DAL fallback)', async () => {
        mediaDal.getMediaUploadProgress.mockResolvedValueOnce({ status: 'pending', percentage: 0 });

        const response = await request(app)
            .get(`/media/${mediaId}/progress`)
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'pending', percentage: 0 });
    });

    it('returns 400 for an invalid media ID', async () => {
        const response = await request(app)
            .get('/media/not-a-valid-id/progress')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(400);
        expect(mediaDal.getMediaUploadProgress).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
        const response = await request(app).get(`/media/${mediaId}/progress`);

        expect(response.status).toBe(401);
    });
});
