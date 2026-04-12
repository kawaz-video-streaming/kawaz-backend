import { AmqpClient } from '@ido_kawaz/amqp-client';
import type { Application } from '@ido_kawaz/server-framework';
import { ApiError } from '@ido_kawaz/server-framework';
import express from 'express';
import { existsSync, mkdirSync, readdirSync, rmdirSync, rmSync, writeFileSync } from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import request from 'supertest';
import { MediaDal } from '../../../dal/media';
import { UserDal } from '../../../dal/user';
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

describe('POST /media/upload route', () => {
    const AUTH_CONFIG = { jwtSecret: 'media-test-secret', adminPromotionSecret: 'admin-secret' };
    const fixtureDir = path.join(process.cwd(), 'src', 'api', 'media', '__tests__', 'fixtures');
    const fixtureFile = path.join(fixtureDir, 'sample-upload.mp4');
    const fixtureThumbnailFile = path.join(fixtureDir, 'sample-thumbnail.jpg');
    const tmpDir = path.join(process.cwd(), 'tmp');

    let tmpDirExistedBeforeAll = false;
    let fixtureDirExistedBeforeAll = false;
    let tmpEntriesBeforeEach = new Set<string>();

    let app: Application;
    let mediaDal: { createMedia: jest.Mock };
    let userDal: { findUser: jest.Mock };
    let amqpClient: { publish: jest.Mock };
    let storageClient: jest.Mock;
    let adminToken: string;

    beforeAll(() => {
        tmpDirExistedBeforeAll = existsSync(tmpDir);
        fixtureDirExistedBeforeAll = existsSync(fixtureDir);

        mkdirSync(fixtureDir, { recursive: true });
        writeFileSync(fixtureFile, 'test upload content');
        writeFileSync(fixtureThumbnailFile, 'fake jpg content');
        mkdirSync(tmpDir, { recursive: true });
    });

    beforeEach(() => {
        mediaDal = {
            createMedia: jest.fn().mockResolvedValue({
                _id: 'media-1',
                fileName: 'sample-upload.mp4',
                title: 'My Upload',
                tags: [],
                size: 19,
                status: 'pending',
            }),
        };

        userDal = {
            findUser: jest.fn().mockResolvedValue({ name: 'admin', password: 'hash', role: 'admin' }),
        };

        amqpClient = {
            publish: jest.fn(),
        };

        storageClient = jest.fn();

        tmpEntriesBeforeEach = new Set(existsSync(tmpDir) ? readdirSync(tmpDir) : []);

        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);

        app = express();
        app.use(parseCookies);
        app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
        app.use('/media', createMediaRouter({
            kawazPlus: { kawazStorageBucket: 'upload-bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
            vod: { vodStorageBucket: 'vod-bucket' },
        }, mediaDal as unknown as MediaDal, amqpClient as unknown as AmqpClient, storageClient as any));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    afterEach(() => {
        if (!existsSync(tmpDir)) {
            return;
        }

        for (const entry of readdirSync(tmpDir)) {
            if (!tmpEntriesBeforeEach.has(entry)) {
                rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
            }
        }
    });

    afterAll(() => {
        if (existsSync(fixtureFile)) {
            rmSync(fixtureFile, { force: true });
        }
        if (existsSync(fixtureThumbnailFile)) {
            rmSync(fixtureThumbnailFile, { force: true });
        }

        if (!fixtureDirExistedBeforeAll && existsSync(fixtureDir) && readdirSync(fixtureDir).length === 0) {
            rmdirSync(fixtureDir);
        }

        if (!tmpDirExistedBeforeAll && existsSync(tmpDir) && readdirSync(tmpDir).length === 0) {
            rmdirSync(tmpDir);
        }
    });

    it('returns 200 and publishes upload event for valid multipart request', async () => {
        const response = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .field('title', 'My Upload')
            .attach('file', fixtureFile)
            .attach('thumbnail', fixtureThumbnailFile);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Media Started Uploading', mediaId: 'media-1' });

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.createMedia).toHaveBeenCalledWith({
            title: 'My Upload',
            tags: [],
            thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            fileName: 'sample-upload.mp4',
            size: expect.any(Number),
            path: expect.any(String),
            mimetype: expect.any(String),
        });

        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith(
            'upload',
            'upload.media',
            expect.objectContaining({
                media: expect.objectContaining({
                    _id: 'media-1',
                    fileName: 'sample-upload.mp4',
                    size: 19,
                }),
                mediaPath: expect.stringContaining('tmp'),
                thumbnailPath: expect.stringContaining('tmp'),
            }),
        );
    });

    it('returns 400 when request is missing file', async () => {
        const response = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid request');

        expect(mediaDal.createMedia).not.toHaveBeenCalled();
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('returns 500 when DAL createMedia fails', async () => {
        mediaDal.createMedia.mockRejectedValueOnce(new Error('db failure'));

        const response = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .field('title', 'My Upload')
            .attach('file', fixtureFile)
            .attach('thumbnail', fixtureThumbnailFile);

        expect(response.status).toBe(500);
        expect(response.body.message).toContain('db failure');

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });
});

describe('GET /media/uploading', () => {
    const AUTH_CONFIG = { jwtSecret: 'uploading-test-secret', adminPromotionSecret: 'admin-secret' };

    let app: Application;
    let mediaDal: { getAllNoneCompletedMedia: jest.Mock };
    let userDal: { findUser: jest.Mock };
    let userToken: string;

    const makeApp = () => {
        app = express();
        app.use(parseCookies);
        app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
        app.use('/media', createMediaRouter({
            kawazPlus: { kawazStorageBucket: 'bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
            vod: { vodStorageBucket: 'vod-bucket' },
        }, mediaDal as unknown as MediaDal, {} as unknown as AmqpClient, {} as any));
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

    it('returns 404 when there are no non-completed media', async () => {
        mediaDal.getAllNoneCompletedMedia.mockResolvedValueOnce([]);

        const response = await request(app)
            .get('/media/uploading')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(response.status).toBe(404);
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
    let mediaDal: { getMediaUploadProgress: jest.Mock };
    let userDal: { findUser: jest.Mock };
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
        }, mediaDal as unknown as MediaDal, {} as unknown as AmqpClient, {} as any));
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
