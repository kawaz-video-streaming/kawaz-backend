import { AmqpClient } from '@ido_kawaz/amqp-client';
import { RequestFile } from '@ido_kawaz/server-framework';
import { MediaDal } from '../../../dal/media';
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from '../../../background/upload/binding';
import { createMediaLogic } from '../logic';

describe('createMediaLogic.uploadMedia', () => {
    const makeFile = (overrides: Partial<RequestFile> = {}): RequestFile => ({
        path: '/tmp/default-file.mp4',
        originalname: 'default-file.mp4',
        mimetype: 'video/mp4',
        size: 100,
        ...overrides,
    } as RequestFile);

    it('publishes using persisted media object returned from DAL', async () => {
        const media = { _id: 'm1', name: 'image.png', type: 'image/png', size: 64 };
        const file = makeFile({
            path: '/tmp/image.png',
            originalname: 'image.png',
            mimetype: 'image/png',
            size: 64,
        });

        const mediaDal = {
            createMedia: jest.fn().mockResolvedValue(media),
        } as unknown as MediaDal;

        const amqpClient = {
            publish: jest.fn(),
        } as unknown as AmqpClient;

        const logic = createMediaLogic(mediaDal, amqpClient);

        await logic.uploadMedia(file, false);

        expect(mediaDal.createMedia).toHaveBeenCalledTimes(1);
        expect(mediaDal.createMedia).toHaveBeenCalledWith('image.png', 'image/png', 64, false);
        expect(amqpClient.publish).toHaveBeenCalledTimes(1);
        expect(amqpClient.publish).toHaveBeenCalledWith(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, {
            media,
            path: '/tmp/image.png',
        });
    });

    it('calls publish only after media creation completes', async () => {
        const media = { _id: 'm-order', name: 'ordered.mp4', type: 'video/mp4', size: 99 };
        const file = makeFile({
            path: '/tmp/ordered.mp4',
            originalname: 'ordered.mp4',
            mimetype: 'video/mp4',
            size: 99,
        });

        const mediaDal = {
            createMedia: jest.fn().mockResolvedValue(media),
        } as unknown as MediaDal;

        const amqpClient = {
            publish: jest.fn(),
        } as unknown as AmqpClient;

        const logic = createMediaLogic(mediaDal, amqpClient);

        await logic.uploadMedia(file, true);

        const createMediaCallOrder = (mediaDal.createMedia as jest.Mock).mock.invocationCallOrder[0];
        const publishCallOrder = (amqpClient.publish as jest.Mock).mock.invocationCallOrder[0];

        expect(createMediaCallOrder).toBeLessThan(publishCallOrder);
    });

    it('sends undefined subtitles flag when includeSubtitles is not provided', async () => {
        const media = { _id: 'm2', name: 'clip.mp4', type: 'video/mp4', size: 100 };
        const file = makeFile({
            path: '/tmp/clip.mp4',
            originalname: 'clip.mp4',
            mimetype: 'video/mp4',
            size: 100,
        });

        const mediaDal = {
            createMedia: jest.fn().mockResolvedValue(media),
        } as unknown as MediaDal;

        const amqpClient = {
            publish: jest.fn(),
        } as unknown as AmqpClient;

        const logic = createMediaLogic(mediaDal, amqpClient);

        await logic.uploadMedia(file);

        expect(mediaDal.createMedia).toHaveBeenCalledWith('clip.mp4', 'video/mp4', 100, undefined);
        expect(amqpClient.publish).toHaveBeenCalledWith(UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC, {
            media,
            path: '/tmp/clip.mp4',
        });
    });

    it('propagates DAL failure and never publishes event', async () => {
        const file = makeFile({
            path: '/tmp/fail.mp4',
            originalname: 'fail.mp4',
            mimetype: 'video/mp4',
            size: 1,
        });

        const mediaDal = {
            createMedia: jest.fn().mockRejectedValue(new Error('db write failed')),
        } as unknown as MediaDal;

        const amqpClient = {
            publish: jest.fn(),
        } as unknown as AmqpClient;

        const logic = createMediaLogic(mediaDal, amqpClient);

        await expect(
            logic.uploadMedia(file, true),
        ).rejects.toThrow('db write failed');

        expect(amqpClient.publish).not.toHaveBeenCalled();
    });
});
