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

describe('POST /media/upload route', () => {
    const AUTH_CONFIG = { jwtSecret: 'media-test-secret', adminPromotionSecret: 'admin-secret' };
    const fixtureDir = path.join(process.cwd(), 'src', 'api', 'media', '__tests__', 'fixtures');
    const fixtureFile = path.join(fixtureDir, 'sample-upload.txt');
    const tmpDir = path.join(process.cwd(), 'tmp');

    let tmpDirExistedBeforeAll = false;
    let fixtureDirExistedBeforeAll = false;
    let tmpEntriesBeforeEach = new Set<string>();

    let app: Application;
    let mediaDal: { createMedia: jest.Mock };
    let userDal: { findUser: jest.Mock };
    let amqpClient: { publish: jest.Mock };
    let adminToken: string;

    beforeAll(() => {
        tmpDirExistedBeforeAll = existsSync(tmpDir);
        fixtureDirExistedBeforeAll = existsSync(fixtureDir);

        mkdirSync(fixtureDir, { recursive: true });
        writeFileSync(fixtureFile, 'test upload content');
        mkdirSync(tmpDir, { recursive: true });
    });

    beforeEach(() => {
        mediaDal = {
            createMedia: jest.fn().mockResolvedValue({
                _id: 'media-1',
                name: 'sample-upload.txt',
                type: 'text/plain',
                size: 19,
            }),
        };

        userDal = {
            findUser: jest.fn().mockResolvedValue({ name: 'admin', password: 'hash', role: 'admin' }),
        };

        amqpClient = {
            publish: jest.fn(),
        };

        tmpEntriesBeforeEach = new Set(existsSync(tmpDir) ? readdirSync(tmpDir) : []);

        adminToken = jwt.sign({ username: 'admin', role: 'admin' }, AUTH_CONFIG.jwtSecret);

        app = express();
        app.use(createAuthMiddleware(AUTH_CONFIG, userDal as unknown as UserDal));
        app.use('/media', createMediaRouter(mediaDal as unknown as MediaDal, amqpClient as unknown as AmqpClient));
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
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('file', fixtureFile);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Media Started Uploading' });

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.createMedia).toHaveBeenCalledWith('sample-upload.txt', 'text/plain', 19);

        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith(
            'upload',
            'upload.media',
            expect.objectContaining({
                media: expect.objectContaining({
                    _id: 'media-1',
                    name: 'sample-upload.txt',
                    type: 'text/plain',
                    size: 19,
                }),
                path: expect.stringContaining('tmp'),
            }),
        );
    });

    it('returns 400 when request is missing file', async () => {
        const response = await request(app)
            .post('/media/upload')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid request');

        expect(mediaDal.createMedia).not.toHaveBeenCalled();
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('returns 500 when DAL createMedia fails', async () => {
        mediaDal.createMedia.mockRejectedValueOnce(new Error('db failure'));

        const response = await request(app)
            .post('/media/upload')
            .set('Authorization', `Bearer ${adminToken}`)
            .attach('file', fixtureFile);

        expect(response.status).toBe(500);
        expect(response.body.message).toContain('db failure');

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });
});
