import { AmqpClient } from '@ido_kawaz/amqp-client';
import { Types } from '@ido_kawaz/mongo-client';
import { StorageClient } from '@ido_kawaz/storage-client';
import { Readable } from 'stream';
import { MediaDal } from '../../../dal/media';
import { Media } from '../../../dal/media/model';
import { UploadConfig } from '../config';
import { uploadMediaHandler, uploadSuccessHandler } from '../handler';

jest.mock('fs', () => ({
    createReadStream: jest.fn(() => Readable.from(['fake file content'])),
}));

jest.mock('fs/promises', () => ({
    unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('uploadMediaHandler', () => {
    const fixtureFile = '/tmp/test-media.mp4';
    const fixtureThumbnail = '/tmp/test-thumbnail.jpg';

    let storageClient: { uploadObject: jest.Mock };
    let config: UploadConfig;

    const makeMedia = (overrides: Partial<Media> = {}): Media => ({
        _id: new Types.ObjectId().toString(),
        fileName: 'test-media.mp4',
        title: 'test-media.mp4',
        tags: [],
        size: 1024,
        status: 'pending',
        percentage: 0,
        thumbnailFocalPoint: { x: 0.5, y: 0.5 },
        ...overrides,
    });

    beforeEach(() => {
        storageClient = {
            uploadObject: jest.fn().mockResolvedValue(undefined),
        };

        config = {
            bucketsConfig: {
                kawazPlus: {
                    kawazStorageBucket: 'test-bucket',
                    uploadPrefix: 'raw',
                    thumbnailPrefix: 'raw/thumbnails',
                    avatarPrefix: 'avatars',
                },
                vod: { vodStorageBucket: 'vod-bucket' },
            },
            partSize: 128 * 1024 * 1024,
        };
    });

    it('uploads media file to storage with correct bucket and key prefix', async () => {
        const media = makeMedia({ fileName: 'clip.mp4' });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'test-bucket',
            expect.objectContaining({ key: 'raw/clip.mp4', data: expect.anything() }),
            expect.objectContaining({ ensureBucket: true }),
        );
    });

    it('uploads thumbnail to storage under thumbnails key', async () => {
        const media = makeMedia({ fileName: 'clip.mp4' });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'test-bucket',
            expect.objectContaining({ key: `raw/thumbnails/${media._id}.jpg`, data: expect.anything() }),
            undefined,
        );
    });

    it('uploads both media and thumbnail (two storage calls total)', async () => {
        const media = makeMedia({ fileName: 'clip.mp4' });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail });

        expect(storageClient.uploadObject).toHaveBeenCalledTimes(2);
    });

    it('uses multipart upload when file size exceeds partSize', async () => {
        const media = makeMedia({ fileName: 'large.mp4', size: 200 * 1024 * 1024 });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ key: 'raw/large.mp4', data: expect.anything() }),
            expect.objectContaining({ multipartUpload: true }),
        );
    });

    it('does not use multipart upload when file size is below partSize', async () => {
        const media = makeMedia({ fileName: 'small.mp4', size: 1024 });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ key: 'raw/small.mp4', data: expect.anything() }),
            expect.objectContaining({ multipartUpload: false }),
        );
    });

    it('propagates non-StorageError upload errors', async () => {
        storageClient.uploadObject.mockRejectedValueOnce(new Error('storage failure'));

        const media = makeMedia({ fileName: 'fail.mp4' });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await expect(handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail })).rejects.toThrow('storage failure');
    });
});

describe('uploadSuccessHandler', () => {
    const fixtureFile = '/tmp/test-media.mp4';
    const fixtureThumbnail = '/tmp/test-thumbnail.jpg';

    let amqpClient: { publish: jest.Mock };
    let mediaDal: { updateMedia: jest.Mock };
    let config: UploadConfig;

    const makeMedia = (overrides: Partial<Media> = {}): Media => ({
        _id: new Types.ObjectId().toString(),
        fileName: 'test-media.mp4',
        title: 'test-media.mp4',
        tags: [],
        size: 1024,
        status: 'pending',
        percentage: 0,
        thumbnailFocalPoint: { x: 0.5, y: 0.5 },
        ...overrides,
    });

    beforeEach(() => {
        amqpClient = {
            publish: jest.fn(),
        };

        mediaDal = {
            updateMedia: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        };

        config = {
            bucketsConfig: {
                kawazPlus: {
                    kawazStorageBucket: 'test-bucket',
                    uploadPrefix: 'raw',
                    thumbnailPrefix: 'raw/thumbnails',
                    avatarPrefix: 'avatars',
                },
                vod: { vodStorageBucket: 'vod-bucket' },
            },
            partSize: 128 * 1024 * 1024,
        };
    });

    it('publishes convert event and sets status to processing', async () => {
        const media = makeMedia({
            _id: new Types.ObjectId().toString(),
            fileName: 'video.mp4',
        });
        const handler = uploadSuccessHandler(
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config
        );

        await handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail });

        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith('convert', 'convert.media', {
            mediaId: media._id,
            mediaFileName: 'video.mp4',
            mediaStorageBucket: 'test-bucket',
            mediaRoutingKey: 'raw/video.mp4',
        });

        expect(mediaDal.updateMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMedia).toHaveBeenCalledWith(media._id, { status: 'processing', percentage: 20 });
    });

    it('cleans up temp media file after publishing', async () => {
        const media = makeMedia({ fileName: 'video.mp4' });
        const handler = uploadSuccessHandler(
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config
        );

        await handler({ media, mediaPath: fixtureFile, thumbnailPath: fixtureThumbnail });

        const { unlink } = jest.requireMock('fs/promises') as { unlink: jest.Mock };
        expect(unlink).toHaveBeenCalledWith(fixtureFile);
    });
});
