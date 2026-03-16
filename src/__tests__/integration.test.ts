import type { Application } from '@ido_kawaz/server-framework';
import { ApiError } from '@ido_kawaz/server-framework';
import express from 'express';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { AmqpClient } from '@ido_kawaz/amqp-client';
import { StorageClient } from '@ido_kawaz/storage-client';
import { Types } from '@ido_kawaz/mongo-client';
import { Readable } from 'stream';
import { MediaDal } from '../dal/media';
import { createMediaRouter } from '../api/media';
import { uploadMediaHandler } from '../background/upload/handler';
import { UploadConfig } from '../background/upload/config';

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    createReadStream: jest.fn(() => Readable.from(['fake file content'])),
}));

describe('End-to-end media upload and processing flow', () => {
    let fixtureDir: string;
    let fixtureFile: string;

    let app: Application;
    let mediaDal: {
        createMedia: jest.Mock;
        updateMediaStatus: jest.Mock;
    };
    let amqpClient: {
        publish: jest.Mock;
    };
    let storageClient: {
        uploadObject: jest.Mock;
    };

    const actualFs = jest.requireActual('fs') as typeof import('fs');
    const tmpDir = path.join(process.cwd(), 'tmp');
    let tmpEntriesBeforeEach = new Set<string>();

    beforeAll(() => {
        fixtureDir = actualFs.mkdtempSync(path.join(os.tmpdir(), 'integration-test-'));
        fixtureFile = path.join(fixtureDir, 'sample.mp4');
        actualFs.writeFileSync(fixtureFile, 'test video content');
    });

    afterAll(() => {
        actualFs.rmSync(fixtureDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        tmpEntriesBeforeEach = new Set(actualFs.existsSync(tmpDir) ? actualFs.readdirSync(tmpDir) : []);
        mediaDal = {
            createMedia: jest.fn().mockResolvedValue({
                _id: new Types.ObjectId(),
                name: 'sample.mp4',
                type: 'video/mp4',
                size: 18,
                status: 'pending',
            }),
            updateMediaStatus: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        };

        amqpClient = {
            publish: jest.fn(),
        };

        storageClient = {
            uploadObject: jest.fn().mockResolvedValue(undefined),
        };

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
            .attach('file', fixtureFile);

        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body).toEqual({ message: 'Media Started Uploading' });

        // Verify media was persisted
        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.createMedia).toHaveBeenCalledWith('sample.mp4', 'video/mp4', expect.any(Number));

        // Verify upload event was published to AMQP
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        const [exchange, topic, uploadPayload] = (amqpClient.publish as jest.Mock).mock.calls[0];
        expect(exchange).toBe('upload');
        expect(topic).toBe('upload.media');
        expect(uploadPayload).toMatchObject({
            media: expect.objectContaining({
                name: 'sample.mp4',
                type: 'video/mp4',
                size: 18,
                status: 'pending',
            }),
            path: expect.any(String),
        });

        // Step 2: Simulate background consumer processing the upload event
        const uploadedMedia = uploadPayload.media;
        const uploadConfig: UploadConfig = {
            uploadBucket: 'media-bucket',
            uploadKeyPrefix: 'raw',
            partSize: 128 * 1024 * 1024,
        };

        // Reset mocks to track background processing
        mediaDal.updateMediaStatus.mockClear();
        amqpClient.publish.mockClear();

        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            uploadConfig,
        );

        await handler({ media: uploadedMedia, path: uploadPayload.path });

        // Verify file was uploaded to storage
        expect(storageClient.uploadObject).toHaveBeenCalledTimes(1);
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'media-bucket',
            'raw/sample.mp4',
            expect.anything(),
            expect.objectContaining({ ensureBucket: true, multipartUpload: false }),
        );

        // Verify convert event was published for video
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        const [converterExchange, converterTopic, convertMessage] = (amqpClient.publish as jest.Mock).mock.calls[0];
        expect(converterExchange).toBe('convert');
        expect(converterTopic).toBe('convert.media');
        expect(convertMessage).toEqual({
            mediaId: uploadedMedia._id,
            mediaName: 'sample.mp4',
            mediaStorageBucket: 'media-bucket',
            mediaRoutingKey: 'raw/sample.mp4',
        });

        // Verify status was updated to processing
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(uploadedMedia._id, 'processing');
    });

    it('handles image media differently than video in background processing', async () => {
        mediaDal.createMedia.mockResolvedValueOnce({
            _id: new Types.ObjectId().toString(),
            name: 'photo.png',
            type: 'image/png',
            size: expect.any(Number),
            status: 'pending',
        });

        // Step 1: Upload image via API
        const uploadResponse = await request(app)
            .post('/media/upload')
            .attach('file', fixtureFile);

        expect(uploadResponse.status).toBe(200);

        // Get the uploaded media from the AMQP publish call
        const uploadPayload = (amqpClient.publish as jest.Mock).mock.calls[0][2];
        const uploadedMedia = uploadPayload.media;

        // Step 2: Process image in background
        mediaDal.updateMediaStatus.mockClear();
        amqpClient.publish.mockClear();

        const uploadConfig: UploadConfig = {
            uploadBucket: 'media-bucket',
            uploadKeyPrefix: 'raw',
            partSize: 128 * 1024 * 1024,
        };

        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            uploadConfig,
        );

        await handler({ media: uploadedMedia, path: uploadPayload.path });

        // Verify NO convert event for images
        expect(amqpClient.publish).not.toHaveBeenCalled();

        // Verify status was set to completed (not processing)
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(uploadedMedia._id, 'completed');
    });

    it('handles upload failure gracefully with proper error responses', async () => {
        mediaDal.createMedia.mockRejectedValueOnce(new Error('database connection lost'));

        // Attempt to upload with DB failure
        const uploadResponse = await request(app)
            .post('/media/upload')
            .attach('file', fixtureFile);

        expect(uploadResponse.status).toBe(500);
        expect(uploadResponse.body.message).toContain('database connection lost');

        // Verify no AMQP event was published on failure
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });

    it('validates request and returns 400 for missing file', async () => {
        const response = await request(app)
            .post('/media/upload')
            .field('includeSubtitles', 'false');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid request');

        // Verify no media was created or published
        expect(mediaDal.createMedia).not.toHaveBeenCalled();
        expect(amqpClient.publish).not.toHaveBeenCalled();
    });
});
