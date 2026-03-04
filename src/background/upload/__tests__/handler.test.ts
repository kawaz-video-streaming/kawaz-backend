import { StorageClient } from '@ido_kawaz/storage-client';
import { AmqpClient } from '@ido_kawaz/amqp-client';
import { Types } from '@ido_kawaz/mongo-client';
import { Readable } from 'stream';
import { MediaDal } from '../../../dal/media';
import { MediaDocument } from '../../../dal/media/model';
import { UploadConfig } from '../config';
import { uploadMediaHandler } from '../handler';

jest.mock('fs', () => ({
    createReadStream: jest.fn(() => Readable.from(['fake file content'])),
}));

describe('uploadMediaHandler', () => {
    const fixtureFile = '/tmp/test-media.mp4';

    let storageClient: { uploadObject: jest.Mock };
    let amqpClient: { publish: jest.Mock };
    let mediaDal: { updateMediaStatus: jest.Mock };
    let config: UploadConfig;

    const makeMedia = (overrides: Partial<MediaDocument> = {}): MediaDocument => ({
        _id: new Types.ObjectId(),
        name: 'test-media.mp4',
        type: 'video/mp4',
        size: 1024,
        status: 'pending',
        ...overrides,
    });

    beforeEach(() => {
        storageClient = {
            uploadObject: jest.fn().mockResolvedValue(undefined),
        };

        amqpClient = {
            publish: jest.fn(),
        };

        mediaDal = {
            updateMediaStatus: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        };

        config = {
            uploadBucket: 'test-bucket',
            uploadKeyPrefix: 'raw',
            partSize: 128 * 1024 * 1024,
        };
    });

    it('uploads file to storage with correct bucket and key prefix', async () => {
        const media = makeMedia({ name: 'clip.mp4', type: 'video/mp4' });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await handler({ media, path: fixtureFile });

        expect(storageClient.uploadObject).toHaveBeenCalledTimes(1);
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'test-bucket',
            'raw/clip.mp4',
            expect.anything(),
            expect.objectContaining({ ensureBucket: true }),
        );
    });

    it('uses multipart upload when file size exceeds partSize', async () => {
        const media = makeMedia({ name: 'large.mp4', type: 'video/mp4', size: 200 * 1024 * 1024 });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await handler({ media, path: fixtureFile });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.anything(),
            expect.objectContaining({ multipartUpload: true }),
        );
    });

    it('does not use multipart upload when file size is below partSize', async () => {
        const media = makeMedia({ name: 'small.mp4', type: 'video/mp4', size: 1024 });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await handler({ media, path: fixtureFile });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.anything(),
            expect.objectContaining({ multipartUpload: false }),
        );
    });

    it('publishes convert event and sets status to processing for video media', async () => {
        const media = makeMedia({
            name: 'video.mp4',
            type: 'video/mp4',
            includesSubtitles: true,
        });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await handler({ media, path: fixtureFile });

        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith('convert', 'convert.media', {
            mediaName: 'video.mp4',
            mediaStorageBucket: 'test-bucket',
            mediaRoutingKey: 'raw/video.mp4',
            includesSubtitles: true,
        });

        expect(mediaDal.updateMediaStatus).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(media._id, 'processing');
    });

    it('sets status to completed and does not publish convert event for image media', async () => {
        const media = makeMedia({
            name: 'photo.png',
            type: 'image/png',
        });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await handler({ media, path: fixtureFile });

        expect(amqpClient.publish).not.toHaveBeenCalled();
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(media._id, 'completed');
    });

    it('defaults includesSubtitles to false when not provided for video', async () => {
        const media = makeMedia({
            name: 'no-subs.mp4',
            type: 'video/mp4',
            includesSubtitles: undefined,
        });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await handler({ media, path: fixtureFile });

        expect(amqpClient.publish).toHaveBeenCalledWith(
            'convert',
            'convert.media',
            expect.objectContaining({ includesSubtitles: false }),
        );
    });

    it('does not update status for non-video and non-image media types', async () => {
        const media = makeMedia({
            name: 'document.pdf',
            type: 'application/pdf',
        });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await handler({ media, path: fixtureFile });

        expect(storageClient.uploadObject).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).not.toHaveBeenCalled();
        expect(mediaDal.updateMediaStatus).not.toHaveBeenCalled();
    });

    it('propagates storage upload error and does not update status', async () => {
        storageClient.uploadObject.mockRejectedValueOnce(new Error('storage failure'));

        const media = makeMedia({ name: 'fail.mp4', type: 'video/mp4' });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config,
        );

        await expect(handler({ media, path: fixtureFile })).rejects.toThrow('storage failure');

        expect(amqpClient.publish).not.toHaveBeenCalled();
        expect(mediaDal.updateMediaStatus).not.toHaveBeenCalled();
    });
});
