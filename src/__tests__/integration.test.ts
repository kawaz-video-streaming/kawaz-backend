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
import request from 'supertest';
import { AmqpClient } from '@ido_kawaz/amqp-client';
import { StorageClient } from '@ido_kawaz/storage-client';
import { Types } from '@ido_kawaz/mongo-client';
import { UserDal } from '../dal/user';
import { AvatarCategoryDal } from '../dal/avatarCategory';
import { AvatarDal } from '../dal/avatar';
import { Dals } from '../dal/types';
import { createMediaRouter } from '../api/media';
import { createAuthRouter } from '../api/auth';
import { createAvatarCategoryRouter } from '../api/avatarCategory';
import { createAuthMiddleware } from '../api/middleware';
import { Mailer } from '../services/mailer';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('Media upload integration', () => {
    const AUTH_CONFIG = { jwtSecret: 'integration-test-secret', adminPromotionSecret: 'integration-admin-secret' };

    let app: Application;
    let mediaDal: { createMedia: jest.Mock; getPendingMedia: jest.Mock; updateMedia: jest.Mock };
    let userDal: { verifyUser: jest.Mock; createUser: jest.Mock; findUser: jest.Mock; promoteToAdmin: jest.Mock };
    let amqpClient: { publish: jest.Mock };
    let storageClient: { ensureBucket: jest.Mock; getPutPresignedUrl: jest.Mock };
    let adminToken: string;

    const makeMediaId = () => new Types.ObjectId().toString();

    beforeEach(() => {
        const mediaId = makeMediaId();

        mediaDal = {
            createMedia: jest.fn().mockResolvedValue({
                _id: mediaId,
                fileName: 'sample.mp4',
                title: 'My Sample',
                tags: [],
                size: 1024,
                status: 'pending',
            }),
            getPendingMedia: jest.fn().mockResolvedValue({
                _id: mediaId,
                fileName: 'sample.mp4',
                title: 'My Sample',
                tags: [],
                size: 1024,
                status: 'pending',
            }),
            updateMedia: jest.fn().mockResolvedValue(undefined),
        };

        userDal = {
            verifyUser: jest.fn().mockResolvedValue(true),
            createUser: jest.fn().mockResolvedValue(undefined),
            findUser: jest.fn().mockResolvedValue({ name: 'admin', password: 'hashed-password', role: 'admin', status: 'approved' }),
            promoteToAdmin: jest.fn(),
        };

        amqpClient = { publish: jest.fn() };

        storageClient = {
            ensureBucket: jest.fn().mockResolvedValue(undefined),
            getPutPresignedUrl: jest.fn()
                .mockResolvedValueOnce('https://minio/raw/sample.mp4?sig=abc')
                .mockResolvedValueOnce(`https://minio/raw/thumbnails/${mediaId}.jpg?sig=xyz`),
        };

        mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
        mockedBcrypt.compare.mockResolvedValue(true as never);

        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);

        const authMiddleware = createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal);

        app = express();
        app.use(parseCookies);
        app.use(express.json());
        const mailer = {
            sendApprovalRequestEmail: jest.fn().mockResolvedValue(undefined),
            sendApprovalEmail: jest.fn().mockResolvedValue(undefined),
            sendDenialEmail: jest.fn().mockResolvedValue(undefined),
        } as unknown as Mailer;
        app.use('/auth', createAuthRouter(AUTH_CONFIG, mailer, userDal as unknown as UserDal));
        app.use(authMiddleware);
        app.use('/media', createMediaRouter({
            kawazPlus: { kawazStorageBucket: 'upload-bucket', uploadPrefix: 'raw', thumbnailPrefix: 'raw/thumbnails', avatarPrefix: 'avatars' },
            vod: { vodStorageBucket: 'vod-bucket' },
        }, { mediaDal, mediaCollectionDal: {} } as unknown as Dals, amqpClient as unknown as AmqpClient, storageClient as unknown as StorageClient));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('initiates upload and returns presigned URLs, then complete triggers conversion', async () => {
        const initiateRes = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ title: 'My Sample', kind: 'movie', fileName: 'sample.mp4', fileSize: 1024, mimeType: 'video/mp4' });

        expect(initiateRes.status).toBe(200);
        expect(initiateRes.body).toMatchObject({
            mediaId: expect.any(String),
            videoUploadUrl: expect.stringContaining('minio'),
            thumbnailUploadUrl: expect.stringContaining('minio'),
        });

        expect(mediaDal.createMedia).toHaveBeenCalledWith(expect.objectContaining({
            title: 'My Sample',
            fileName: 'sample.mp4',
            size: 1024,
        }));

        const { mediaId } = initiateRes.body;

        mediaDal.getPendingMedia.mockResolvedValue({
            _id: mediaId,
            fileName: 'sample.mp4',
            title: 'My Sample',
            tags: [],
            size: 1024,
            status: 'pending',
        });

        const completeRes = await request(app)
            .post('/media/upload/complete')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ mediaId });

        expect(completeRes.status).toBe(200);
        expect(completeRes.body).toMatchObject({ message: 'Media processing started' });

        expect(amqpClient.publish).toHaveBeenCalledWith('convert', 'convert.media', {
            mediaId,
            mediaFileName: 'sample.mp4',
            mediaStorageBucket: 'upload-bucket',
            mediaRoutingKey: 'raw/sample.mp4',
        });
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(mediaId, { status: 'processing', percentage: 20 });
    });

    it('returns 404 on complete when media is not in pending state', async () => {
        mediaDal.getPendingMedia.mockResolvedValue(null);

        const res = await request(app)
            .post('/media/upload/complete')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ mediaId: 'some-id' });

        expect(res.status).toBe(404);
        expect(amqpClient.publish).not.toHaveBeenCalled();
        expect(mediaDal.updateMedia).not.toHaveBeenCalled();
    });

    it('handles initiate failure gracefully when DAL throws', async () => {
        mediaDal.createMedia.mockRejectedValueOnce(new Error('database connection lost'));

        const res = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ title: 'My Sample', kind: 'movie', fileName: 'sample.mp4', fileSize: 1024, mimeType: 'video/mp4' });

        expect(res.status).toBe(500);
        expect(res.body.message).toContain('database connection lost');
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('validates initiate request and returns 400 for missing required fields', async () => {
        const res = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ title: 'My Sample' });

        expect(res.status).toBe(400);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('signup → login → initiate upload with admin token', async () => {
        userDal.verifyUser.mockResolvedValueOnce(false);

        const signupRes = await request(app)
            .post('/auth/signup')
            .send({ username: 'admin', password: 'strongpassword123', email: 'admin@example.com' });

        expect(signupRes.status).toBe(202);

        const loginRes = await request(app)
            .post('/auth/login')
            .send({ username: 'admin', password: 'strongpassword123' });

        expect(loginRes.status).toBe(200);
        const setCookieHeader = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
        const tokenCookie = setCookieHeader!.find((c: string) => c.startsWith('kawaz-token='));
        const loginToken = tokenCookie!.split(';')[0].split('=')[1];

        const initiateRes = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${loginToken}`)
            .send({ title: 'My Sample', kind: 'movie', fileName: 'sample.mp4', fileSize: 1024, mimeType: 'video/mp4' });

        expect(initiateRes.status).toBe(200);
        expect(initiateRes.body.mediaId).toBeDefined();
        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when non-admin user tries to initiate upload', async () => {
        userDal.findUser.mockResolvedValue({ name: 'ido', password: 'hashed-password', role: 'user' });
        const userToken = jwt.sign({ username: 'ido', role: 'user' }, AUTH_CONFIG.jwtSecret);

        const res = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', `kawaz-token=${userToken}`)
            .send({ title: 'My Sample', fileName: 'sample.mp4', fileSize: 1024, mimeType: 'video/mp4' });

        expect(res.status).toBe(401);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('returns 401 when accessing protected route without token', async () => {
        const res = await request(app)
            .post('/media/upload/initiate')
            .send({ title: 'My Sample', fileName: 'sample.mp4', fileSize: 1024, mimeType: 'video/mp4' });

        expect(res.status).toBe(401);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('returns 401 when accessing protected route with invalid token', async () => {
        const res = await request(app)
            .post('/media/upload/initiate')
            .set('Cookie', 'kawaz-token=invalid.token.here')
            .send({ title: 'My Sample', fileName: 'sample.mp4', fileSize: 1024, mimeType: 'video/mp4' });

        expect(res.status).toBe(401);
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
    });

    it('returns 409 on duplicate signup', async () => {
        const response = await request(app)
            .post('/auth/signup')
            .send({ username: 'ido', password: 'strongpassword123', email: 'ido@example.com' });

        expect(response.status).toBe(409);
        expect(userDal.createUser).not.toHaveBeenCalled();
    });
});

describe('AvatarCategory integration', () => {
    const AUTH_CONFIG = { jwtSecret: 'integration-test-secret', adminPromotionSecret: 'integration-admin-secret' };

    let app: Application;
    let avatarCategoryDal: { getAllCategories: jest.Mock; getCategory: jest.Mock; createCategory: jest.Mock; deleteCategory: jest.Mock; verifyCategoryExists: jest.Mock };
    let avatarDal: { isCategoryEmpty: jest.Mock };
    let userDal: { verifyUser: jest.Mock; findUser: jest.Mock };
    let adminToken: string;
    let userToken: string;

    const makeValidCategoryId = () => new Types.ObjectId().toString();

    beforeEach(() => {
        avatarCategoryDal = {
            getAllCategories: jest.fn().mockResolvedValue([]),
            getCategory: jest.fn().mockResolvedValue(null),
            createCategory: jest.fn().mockResolvedValue(undefined),
            deleteCategory: jest.fn().mockResolvedValue(undefined),
            verifyCategoryExists: jest.fn().mockResolvedValue(true),
        };

        avatarDal = {
            isCategoryEmpty: jest.fn().mockResolvedValue(true),
        };

        userDal = {
            verifyUser: jest.fn().mockResolvedValue(true),
            findUser: jest.fn().mockImplementation((username: string) => {
                if (username === 'user') return Promise.resolve({ name: 'user', password: 'hashed-password', role: 'user', status: 'approved' });
                return Promise.resolve({ name: 'admin', password: 'hashed-password', role: 'admin', status: 'approved' });
            }),
        };

        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);
        userToken = jwt.sign({ username: 'user', role: 'user' }, AUTH_CONFIG.jwtSecret);

        const authMiddleware = createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal);

        app = express();
        app.use(parseCookies);
        app.use(express.json());
        app.use(authMiddleware);
        app.use('/avatar-category', createAvatarCategoryRouter({
            avatarCategoryDal: avatarCategoryDal as unknown as AvatarCategoryDal,
            avatarDal: avatarDal as unknown as AvatarDal,
        } as unknown as Dals));
        app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (error instanceof ApiError) {
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            const message = error instanceof Error ? error.message : 'Internal server error';
            res.status(500).json({ message });
        });
    });

    it('GET /avatar-category returns all categories', async () => {
        const categories = [{ _id: 'cat-1', name: 'Animals' }, { _id: 'cat-2', name: 'Nature' }];
        avatarCategoryDal.getAllCategories.mockResolvedValue(categories);

        const res = await request(app)
            .get('/avatar-category')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(categories);
    });

    it('GET /avatar-category/:categoryId returns a specific category', async () => {
        const id = makeValidCategoryId();
        const category = { _id: id, name: 'Animals' };
        avatarCategoryDal.getCategory.mockResolvedValue(category);

        const res = await request(app)
            .get(`/avatar-category/${id}`)
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(category);
    });

    it('GET /avatar-category/:categoryId returns 404 when category does not exist', async () => {
        const id = makeValidCategoryId();
        avatarCategoryDal.getCategory.mockResolvedValue(null);

        const res = await request(app)
            .get(`/avatar-category/${id}`)
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(res.status).toBe(404);
    });

    it('GET /avatar-category/:categoryId returns 400 for invalid id', async () => {
        const res = await request(app)
            .get('/avatar-category/not-valid-id')
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(res.status).toBe(400);
        expect(avatarCategoryDal.getCategory).not.toHaveBeenCalled();
    });

    it('POST /avatar-category creates a category', async () => {
        const res = await request(app)
            .post('/avatar-category')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ name: 'Animals' });

        expect(res.status).toBe(201);
        expect(avatarCategoryDal.createCategory).toHaveBeenCalledWith('Animals');
    });

    it('POST /avatar-category returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/avatar-category')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({});

        expect(res.status).toBe(400);
        expect(avatarCategoryDal.createCategory).not.toHaveBeenCalled();
    });

    it('POST /avatar-category returns 409 on duplicate name', async () => {
        avatarCategoryDal.createCategory.mockRejectedValue(new Error('duplicate key error'));

        const res = await request(app)
            .post('/avatar-category')
            .set('Cookie', `kawaz-token=${adminToken}`)
            .send({ name: 'Animals' });

        expect(res.status).toBe(409);
    });

    it('DELETE /avatar-category/:categoryId deletes a category', async () => {
        const id = makeValidCategoryId();
        avatarDal.isCategoryEmpty.mockResolvedValue(true);

        const res = await request(app)
            .delete(`/avatar-category/${id}`)
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(res.status).toBe(200);
        expect(avatarCategoryDal.deleteCategory).toHaveBeenCalledWith(id);
    });

    it('DELETE /avatar-category/:categoryId returns 400 when category has avatars', async () => {
        const id = makeValidCategoryId();
        avatarDal.isCategoryEmpty.mockResolvedValue(false);

        const res = await request(app)
            .delete(`/avatar-category/${id}`)
            .set('Cookie', `kawaz-token=${adminToken}`);

        expect(res.status).toBe(400);
        expect(avatarCategoryDal.deleteCategory).not.toHaveBeenCalled();
    });

    it('GET /avatar-category is accessible by non-admin users', async () => {
        const categories = [{ _id: 'cat-1', name: 'Animals' }];
        avatarCategoryDal.getAllCategories.mockResolvedValue(categories);

        const res = await request(app)
            .get('/avatar-category')
            .set('Cookie', `kawaz-token=${userToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(categories);
    });

    it('returns 401 when accessing without token', async () => {
        const res = await request(app).get('/avatar-category');
        expect(res.status).toBe(401);
    });

    it('returns 401 when accessing with invalid token', async () => {
        const res = await request(app)
            .get('/avatar-category')
            .set('Cookie', 'kawaz-token=invalid.token.here');
        expect(res.status).toBe(401);
    });
});
