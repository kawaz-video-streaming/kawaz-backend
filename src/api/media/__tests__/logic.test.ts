import { AmqpClient } from '@ido_kawaz/amqp-client';
import { MediaDal } from '../../../dal/media';
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from '../../../background/upload/binding';
import { createMediaLogic } from '../logic';
import { MediaUpdateRequestBody } from '../types';
import { UploadedFile } from '../../../utils/types';

const makeMediaConfig = () => ({
    vodStorageBucket: 'vod-bucket',
    uploadStorageBucket: 'upload-bucket',
    uploadKeyPrefix: 'raw',
});

const makeFile = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
    path: '/tmp/video.mp4',
    fileName: 'video.mp4',
    mimetype: 'video/mp4',
    size: 64,
    ...overrides,
});

const makeThumbnail = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
    path: '/tmp/thumb.jpg',
    fileName: 'thumb.jpg',
    mimetype: 'image/jpeg',
    size: 8,
    ...overrides,
});

const makeBody = (overrides: Partial<MediaUpdateRequestBody> = {}): MediaUpdateRequestBody => ({
    title: 'My Video',
    tags: [],
    thumbnailFocalPoint: { x: 0.5, y: 0.5 },
    ...overrides,
});

describe('createMediaLogic.uploadMedia', () => {
    it('persists media then publishes upload event with correct payload', async () => {
        const media = { _id: 'm1', fileName: 'video.mp4', title: 'My Video', tags: [], size: 64, status: 'pending' };
        const file = makeFile();
        const thumbnail = makeThumbnail();
        const body = makeBody();

        const mediaDal = {
            createMedia: jest.fn().mockResolvedValue(media),
        } as unknown as MediaDal;

        const amqpClient = {
            publish: jest.fn(),
        } as unknown as AmqpClient;

        const logic = createMediaLogic(makeMediaConfig(), mediaDal, amqpClient, {} as any);

        await logic.uploadMedia(body, file, thumbnail);

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.createMedia).toHaveBeenCalledWith({
            title: 'My Video',
            tags: [],
            thumbnailFocalPoint: { x: 0.5, y: 0.5 },
            path: '/tmp/video.mp4',
            fileName: 'video.mp4',
            mimetype: 'video/mp4',
            size: 64,
        });
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, {
            media,
            mediaPath: '/tmp/video.mp4',
            thumbnailPath: '/tmp/thumb.jpg',
        });
    });

    it('passes description and thumbnailFocalPoint to createMedia', async () => {
        const media = { _id: 'm2', fileName: 'video.mp4', title: 'My Video', tags: [], size: 64, status: 'pending', description: 'A great video' };
        const file = makeFile();
        const thumbnail = makeThumbnail();
        const body = makeBody({ description: 'A great video', thumbnailFocalPoint: { x: 0.3, y: 0.7 } });

        const mediaDal = { createMedia: jest.fn().mockResolvedValue(media) } as unknown as MediaDal;
        const amqpClient = { publish: jest.fn() } as unknown as AmqpClient;

        const logic = createMediaLogic(makeMediaConfig(), mediaDal, amqpClient, {} as any);

        await logic.uploadMedia(body, file, thumbnail);

        expect(mediaDal.createMedia).toHaveBeenCalledWith({
            title: 'My Video',
            description: 'A great video',
            tags: [],
            thumbnailFocalPoint: { x: 0.3, y: 0.7 },
            path: '/tmp/video.mp4',
            fileName: 'video.mp4',
            mimetype: 'video/mp4',
            size: 64,
        });
    });

    it('always includes thumbnailPath in AMQP payload', async () => {
        const media = { _id: 'm3', fileName: 'video.mp4', title: 'My Video', tags: [], size: 64, status: 'pending' };
        const file = makeFile();
        const thumbnail = makeThumbnail({ path: '/tmp/custom-thumb.jpg' });
        const body = makeBody();

        const mediaDal = { createMedia: jest.fn().mockResolvedValue(media) } as unknown as MediaDal;
        const amqpClient = { publish: jest.fn() } as unknown as AmqpClient;

        const logic = createMediaLogic(makeMediaConfig(), mediaDal, amqpClient, {} as any);

        await logic.uploadMedia(body, file, thumbnail);

        expect(amqpClient.publish).toHaveBeenCalledWith(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, {
            media,
            mediaPath: '/tmp/video.mp4',
            thumbnailPath: '/tmp/custom-thumb.jpg',
        });
    });

    it('calls publish only after media creation completes', async () => {
        const media = { _id: 'm-order', fileName: 'ordered.mp4', title: 'Ordered', tags: [], size: 99, status: 'pending' };
        const file = makeFile({ fileName: 'ordered.mp4', size: 99 });
        const thumbnail = makeThumbnail();
        const body = makeBody({ title: 'Ordered' });

        const mediaDal = { createMedia: jest.fn().mockResolvedValue(media) } as unknown as MediaDal;
        const amqpClient = { publish: jest.fn() } as unknown as AmqpClient;

        const logic = createMediaLogic(makeMediaConfig(), mediaDal, amqpClient, {} as any);

        await logic.uploadMedia(body, file, thumbnail);

        const createMediaCallOrder = (mediaDal.createMedia as jest.Mock).mock.invocationCallOrder[0];
        const publishCallOrder = (amqpClient.publish as jest.Mock).mock.invocationCallOrder[0];

        expect(createMediaCallOrder).toBeLessThan(publishCallOrder);
    });

    it('propagates DAL failure and never publishes event', async () => {
        const mediaDal = {
            createMedia: jest.fn().mockRejectedValue(new Error('db write failed')),
        } as unknown as MediaDal;

        const amqpClient = { publish: jest.fn() } as unknown as AmqpClient;

        const logic = createMediaLogic(makeMediaConfig(), mediaDal, amqpClient, {} as any);

        await expect(logic.uploadMedia(makeBody(), makeFile(), makeThumbnail())).rejects.toThrow('db write failed');

        expect(amqpClient.publish).not.toHaveBeenCalled();
    });
});
