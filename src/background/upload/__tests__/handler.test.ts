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

    let storageClient: { uploadObject: jest.Mock };
    let config: UploadConfig;

    const makeMedia = (overrides: Partial<Media> = {}): Media => ({
        _id: new Types.ObjectId().toString(),
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
            config
        );

        await handler({ media, path: fixtureFile });

        expect(storageClient.uploadObject).toHaveBeenCalledTimes(1);
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'test-bucket',
            expect.objectContaining({ key: 'raw/clip.mp4', data: expect.anything() }),
            expect.objectContaining({ ensureBucket: true }),
        );
    });

    it('uses multipart upload when file size exceeds partSize', async () => {
        const media = makeMedia({ name: 'large.mp4', type: 'video/mp4', size: 200 * 1024 * 1024 });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await handler({ media, path: fixtureFile });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ key: expect.any(String), data: expect.anything() }),
            expect.objectContaining({ multipartUpload: true }),
        );
    });

    it('does not use multipart upload when file size is below partSize', async () => {
        const media = makeMedia({ name: 'small.mp4', type: 'video/mp4', size: 1024 });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await handler({ media, path: fixtureFile });

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ key: expect.any(String), data: expect.anything() }),
            expect.objectContaining({ multipartUpload: false }),
        );
    });

    it('propagates non-StorageError upload errors', async () => {
        storageClient.uploadObject.mockRejectedValueOnce(new Error('storage failure'));

        const media = makeMedia({ name: 'fail.mp4', type: 'video/mp4' });
        const handler = uploadMediaHandler(
            storageClient as unknown as StorageClient,
            config
        );

        await expect(handler({ media, path: fixtureFile })).rejects.toThrow('storage failure');
    });
});

describe('uploadSuccessHandler', () => {
    const fixtureFile = '/tmp/test-media.mp4';

    let amqpClient: { publish: jest.Mock };
    let mediaDal: { updateMediaStatus: jest.Mock };
    let config: UploadConfig;

    const makeMedia = (overrides: Partial<Media> = {}): Media => ({
        _id: new Types.ObjectId().toString(),
        name: 'test-media.mp4',
        type: 'video/mp4',
        size: 1024,
        status: 'pending',
        ...overrides,
    });

    beforeEach(() => {
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

    it('publishes convert event and sets status to processing for video media', async () => {
        const media = makeMedia({
            _id: new Types.ObjectId().toString(),
            name: 'video.mp4',
            type: 'video/mp4',
        });
        const handler = uploadSuccessHandler(
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config
        );

        await handler({ media, path: fixtureFile });

        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith('convert', 'convert.media', {
            mediaId: media._id,
            mediaName: 'video.mp4',
            mediaStorageBucket: 'test-bucket',
            mediaRoutingKey: 'raw/video.mp4',
        });

        expect(mediaDal.updateMediaStatus).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(media._id, 'processing');
    });

    it('sets status to completed and does not publish convert event for image media', async () => {
        const media = makeMedia({
            name: 'photo.png',
            type: 'image/png',
        });
        const handler = uploadSuccessHandler(
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config
        );

        await handler({ media, path: fixtureFile });

        expect(amqpClient.publish).not.toHaveBeenCalled();
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledTimes(1);
        expect(mediaDal.updateMediaStatus).toHaveBeenCalledWith(media._id, 'completed');
    });

    it('does not update status for non-video and non-image media types', async () => {
        const media = makeMedia({
            name: 'document.pdf',
            type: 'application/pdf',
        });
        const handler = uploadSuccessHandler(
            amqpClient as unknown as AmqpClient,
            mediaDal as unknown as MediaDal,
            config
        );

        await handler({ media, path: fixtureFile });

        expect(amqpClient.publish).not.toHaveBeenCalled();
        expect(mediaDal.updateMediaStatus).not.toHaveBeenCalled();
    });
});
