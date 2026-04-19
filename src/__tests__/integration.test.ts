import type { Application } from '@ido_kawaz/server-framework';
import { ApiError } from '@ido_kawaz/server-framework';
import bcrypt from 'bcrypt';
import express, { NextFunction, Request, Response } from 'express';

const parseCookies = (req: Request, _res: Response, next: NextFunction) => {
    req.cookies = {};
    const header = req.headers.cookie ?? '';
    for (const pair of header.split(';')) {
        const idx = pair.indexOf('=');
        if (idx > 0) req.cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
    next();
};
import jwt from 'jsonwebtoken';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { AmqpClient } from '@ido_kawaz/amqp-client';
import { StorageClient } from '@ido_kawaz/storage-client';
import { Types } from '@ido_kawaz/mongo-client';
import { Readable } from 'stream';
import { MediaDal } from '../dal/media';
import { UserDal } from '../dal/user';
import { createMediaRouter } from '../api/media';
import { createAuthRouter } from '../api/auth';
import { createAuthMiddleware } from '../api/middleware';
import { uploadMediaHandler, uploadSuccessHandler } from '../background/upload/handler';
import { UploadConfig } from '../background/upload/config';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    createReadStream: jest.fn(() => Readable.from(['fake file content'])),
}));

describe('Media upload integration', () => {
    const AUTH_CONFIG = { jwtSecret: 'integration-test-secret', adminPromotionSecret: 'integration-admin-secret' };

    let app: Application;
    let mediaDal: { createMedia: jest.Mock; updateMedia: jest.Mock };
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock };
    let amqpClient: { publish: jest.Mock };
    let storageClient: { uploadObject: jest.Mock };
    let adminToken: string;

    const actualFs = jest.requireActual('fs') as typeof import('fs');
    const tmpDir = path.join(process.cwd(), 'tmp');
    let tmpEntriesBeforeEach = new Set<string>();

    let fixtureDir: string;
    let fixtureFile: string;
    let fixtureThumbnailFile: string;

    beforeAll(() => {
        fixtureDir = actualFs.mkdtempSync(path.join(os.tmpdir(), 'integration-test-'));
        fixtureFile = path.join(fixtureDir, 'sample.mp4');
        fixtureThumbnailFile = path.join(fixtureDir, 'thumbnail.jpg');
        actualFs.writeFileSync(fixtureFile, 'test video content');
        actualFs.writeFileSync(fixtureThumbnailFile, 'fake jpg content');
    });

    afterAll(() => {
        actualFs.rmSync(fixtureDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        tmpEntriesBeforeEach = new Set(actualFs.existsSync(tmpDir) ? actualFs.readdirSync(tmpDir) : []);

        mediaDal = {
            createMedia: jest.fn().mockResolvedValue({
                _id: new Types.ObjectId().toString(),
                fileName: 'sample.mp4',
                title: 'My Sample',
                tags: [],
                size: 18,
                status: 'pending',
            }),
            updateMedia: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        };

        userDal = {
            verifyUser: jest.fn().mockResolvedValue(true),
            createUser: jest.fn().mockResolvedValue(undefined),
            findUser: jest.fn().mockResolvedValue({ name: 'admin', password: 'hashed-password', role: 'admin' }),
            promoteToAdmin: jest.fn(),
        };

        amqpClient = { publish: jest.fn() };

        storageClient = { uploadObject: jest.fn().mockResolvedValue(undefined) };

        mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
        mockedBcrypt.compare.mockResolvedValue(true as never);

        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);

        const authMiddleware = createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal);

        app = express();
        app.use(parseCookies);
        app.use(express.json());
        app.use('/auth', createAuthRouter(AUTH_CONFIG, userDal as unknown as UserDal));
        app.use(authMiddleware);
        app.use('/media', createMediaRouter({
            kawazPlus: { kawazStorageBucket: 'upload-bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
            vod: { vodStorageBucket: 'vod-bucket' },
        }, mediaDal as unknown as MediaDal, amqpClient as unknown as AmqpClient, storageClient as unknown as StorageClient));
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
        if (!actualFs.existsSync(tmpDir)) {
            return;
        }
        for (const entry of actualFs.readdirSync(tmpDir)) {
            if (!tmpEntriesBeforeEach.has(entry)) {
                actualFs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
            }
        }
    });

    it('completes full media upload to background processing flow for video', async () => {
        // Step 1: Upload media via API
        const uploadResponse = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .field('title', 'My Sample')
            .attach('file', fixtureFile)
            .attach('thumbnail', fixtureThumbnailFile);

        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body).toMatchObject({ message: 'Media Started Uploading' });
        expect(uploadResponse.body.mediaId).toBeDefined();

        // Verify media was persisted
        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.createMedia).toHaveBeenCalledWith({
            title: 'My Sample',
            tags: [],
            thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            fileName: 'sample.mp4',
            size: expect.any(Number),
            path: expect.any(String),
            mimetype: expect.any(String),
        });

        // Verify upload event was published to AMQP
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        const [exchange, topic, uploadPayload] = (amqpClient.publish as jest.Mock).mock.calls[0];
        expect(exchange).toBe('upload');
        expect(topic).toBe('upload.media');
        expect(uploadPayload).toMatchObject({
            media: expect.objectContaining({
                fileName: 'sample.mp4',
                size: 18,
                status: 'pending',
            }),
            mediaPath: expect.any(String),
            thumbnailPath: expect.any(String),
        });

        // Step 2: Simulate background consumer processing the upload event
        const uploadedMedia = uploadPayload.media;
        const uploadConfig: UploadConfig = {
            bucketsConfig: {
                kawazPlus: { kawazStorageBucket: 'media-bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
                vod: { vodStorageBucket: 'vod-bucket' },
            },
            partSize: 128 * 1024 * 1024,
        };

        mediaDal.updateMedia.mockClear();
        amqpClient.publish.mockClear();
        storageClient.uploadObject.mockClear();

        const uploadHandler = uploadMediaHandler(
            amqpClient as unknown as AmqpClient,
            storageClient as unknown as StorageClient,
            uploadConfig
        );
        const successHandler = uploadSuccessHandler(
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            uploadConfig
        );

        await uploadHandler({ media: uploadedMedia, mediaPath: uploadPayload.mediaPath, thumbnailPath: uploadPayload.thumbnailPath });
        await successHandler({ media: uploadedMedia, mediaPath: uploadPayload.mediaPath, thumbnailPath: uploadPayload.thumbnailPath });

        // Verify both media and thumbnail were uploaded to storage
        expect(storageClient.uploadObject).toHaveBeenCalledTimes(2);
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'media-bucket',
            expect.objectContaining({ key: 'raw/sample.mp4', data: expect.anything() }),
            expect.objectContaining({ ensureBucket: true, multipartUpload: false }),
            expect.any(Function)
        );
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'media-bucket',
            expect.objectContaining({ key: `raw/thumbnails/${uploadedMedia._id}.jpg`, data: expect.anything() }),
            undefined,
            expect.any(Function)
        );

        // Verify convert event was published for video
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        const [converterExchange, converterTopic, convertMessage] = (amqpClient.publish as jest.Mock).mock.calls[0];
        expect(converterExchange).toBe('convert');
        expect(converterTopic).toBe('convert.media');
        expect(convertMessage).toEqual({
            mediaId: uploadedMedia._id,
            mediaFileName: 'sample.mp4',
            mediaStorageBucket: 'media-bucket',
            mediaRoutingKey: 'raw/sample.mp4',
        });

        // Verify status was updated to processing
        expect(mediaDal.updateMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(uploadedMedia._id, { status: 'processing', percentage: 20 });
    });

    it('background consumer always publishes convert event and sets processing status', async () => {
        const uploadResponse = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .field('title', 'My Sample')
            .attach('file', fixtureFile)
            .attach('thumbnail', fixtureThumbnailFile);

        expect(uploadResponse.status).toBe(200);

        const uploadPayload = (amqpClient.publish as jest.Mock).mock.calls[0][2];
        const uploadedMedia = uploadPayload.media;

        mediaDal.updateMedia.mockClear();
        amqpClient.publish.mockClear();

        const uploadConfig: UploadConfig = {
            bucketsConfig: {
                kawazPlus: { kawazStorageBucket: 'media-bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
                vod: { vodStorageBucket: 'vod-bucket' },
            },
            partSize: 128 * 1024 * 1024,
        };

        const successHandler = uploadSuccessHandler(
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            uploadConfig
        );

        await successHandler({ media: uploadedMedia, mediaPath: uploadPayload.mediaPath, thumbnailPath: uploadPayload.thumbnailPath });

        expect(amqpClient.publish).toHaveBeenCalledWith('convert', 'convert.media', expect.objectContaining({
            mediaId: uploadedMedia._id,
            mediaStorageBucket: 'media-bucket',
        }));
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(uploadedMedia._id, { status: 'processing', percentage: 20 });
    });

    it('handles upload failure gracefully with proper error responses', async () => {
        mediaDal.createMedia.mockRejectedValueOnce(new Error('database connection lost'));

        const uploadResponse = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .field('title', 'My Sample')
            .attach('file', fixtureFile)
            .attach('thumbnail', fixtureThumbnailFile);

        expect(uploadResponse.status).toBe(500);
        expect(uploadResponse.body.message).toContain('database connection lost');
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('validates request and returns 400 for missing file', async () => {
        const response = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid request');
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('signup → login → upload media with admin token', async () => {
        // First call to verifyUser is the signup existence check (user doesn't exist yet)
        userDal.verifyUser.mockResolvedValueOnce(false);

        // Step 1: Sign up
        const signupRes = await request(app)
            .post('/auth/signup')
            .send({ username: 'admin', password: 'strongpassword123' });

        expect(signupRes.status).toBe(201);
        expect(signupRes.body).toEqual({ message: 'Signup successful' });

        // Step 2: Login
        const loginRes = await request(app)
            .post('/auth/login')
            .send({ username: 'admin', password: 'strongpassword123' });

        expect(loginRes.status).toBe(200);
        const setCookieHeader = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
        expect(setCookieHeader).toBeDefined();
        const tokenCookie = setCookieHeader!.find((c: string) => c.startsWith('kawaz-token='));
        expect(tokenCookie).toBeDefined();
        const loginToken = tokenCookie!.split(';')[0].split('=')[1];
        expect(loginToken).toBeDefined();

        // Step 3: Upload media using the token from the login cookie
        const uploadRes = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${loginToken}`)
            .field('title', 'My Sample')
            .attach('file', fixtureFile)
            .attach('thumbnail', fixtureThumbnailFile);

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body).toMatchObject({ message: 'Media Started Uploading' });
        expect(uploadRes.body.mediaId).toBeDefined();
        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when non-admin user tries to upload', async () => {
        userDal.findUser.mockResolvedValue({ name: 'ido', password: 'hashed-password', role: 'user' });
        const userToken = jwt.sign({ username: 'ido', role: 'user' }, AUTH_CONFIG.jwtSecret);

        const uploadRes = await request(app)
            .post('/media/upload')
            .set('Cookie', `kawaz-token=${userToken}`)
            .attach('file', fixtureFile);

        expect(uploadRes.status).toBe(401);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('returns 401 when accessing protected route without token', async () => {
        const response = await request(app)
            .post('/media/upload')
            .attach('file', fixtureFile);

        expect(response.status).toBe(401);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('returns 401 when accessing protected route with invalid token', async () => {
        const response = await request(app)
            .post('/media/upload')
            .set('Cookie', 'kawaz-token=invalid.token.here')
            .attach('file', fixtureFile);

        expect(response.status).toBe(401);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('returns 409 on duplicate signup', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123' });

        expect(response.status).toBe(409);
        expect(userDal.createUser).not.toHaveBeenCalled();
    });
});
