import type { Application } from '@ido_kawaz/server-framework';
import { ApiError } from '@ido_kawaz/server-framework';
import express from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { AmqpClient } from '@ido_kawaz/amqp-client';
import { MediaDal } from '../../../dal/media';
import { createMediaRouter } from '../index';

describe('POST /media/upload route', () => {
    const fixtureDir = path.join(process.cwd(), 'src', 'api', 'media', '__tests__', 'fixtures');
    const fixtureFile = path.join(fixtureDir, 'sample-upload.txt');
    const tmpDir = path.join(process.cwd(), 'tmp');

    let tmpDirExistedBeforeAll = false;
    let fixtureDirExistedBeforeAll = false;
    let tmpEntriesBeforeEach = new Set<string>();

    let app: Application;
    let mediaDal: { createMedia: jest.Mock };
    let amqpClient: { publish: jest.Mock };

    beforeAll(() => {
        tmpDirExistedBeforeAll = fs.existsSync(tmpDir);
        fixtureDirExistedBeforeAll = fs.existsSync(fixtureDir);

        fs.mkdirSync(fixtureDir, { recursive: true });
        fs.writeFileSync(fixtureFile, 'test upload content');
        fs.mkdirSync(tmpDir, { recursive: true });
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

        amqpClient = {
            publish: jest.fn(),
        };

        tmpEntriesBeforeEach = new Set(fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : []);

        app = express();
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
        if (!fs.existsSync(tmpDir)) {
            return;
        }

        for (const entry of fs.readdirSync(tmpDir)) {
            if (!tmpEntriesBeforeEach.has(entry)) {
                fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
            }
        }
    });

    afterAll(() => {
        if (fs.existsSync(fixtureFile)) {
            fs.rmSync(fixtureFile, { force: true });
        }

        if (!fixtureDirExistedBeforeAll && fs.existsSync(fixtureDir) && fs.readdirSync(fixtureDir).length === 0) {
            fs.rmdirSync(fixtureDir);
        }

        if (!tmpDirExistedBeforeAll && fs.existsSync(tmpDir) && fs.readdirSync(tmpDir).length === 0) {
            fs.rmdirSync(tmpDir);
        }
    });

    it('returns 200 and publishes upload event for valid multipart request', async () => {
        const response = await request(app)
            .post('/media/upload')
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
            .field('includeSubtitles', 'true');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid request');

        expect(mediaDal.createMedia).not.toHaveBeenCalled();
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('returns 500 when DAL createMedia fails', async () => {
        mediaDal.createMedia.mockRejectedValueOnce(new Error('db failure'));

        const response = await request(app)
            .post('/media/upload')
            .attach('file', fixtureFile);

        expect(response.status).toBe(500);
        expect(response.body.message).toContain('db failure');

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });
});
