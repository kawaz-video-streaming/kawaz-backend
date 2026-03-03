import { AmqpClient, Consumer } from '@ido_kawaz/amqp-client';
import { StorageClient } from '@ido_kawaz/storage-client';
import { MediaDal } from '../../../dal/media';
import { UploadConfig } from '../config';
import { createUploadConsumer } from '../index';
import { UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC } from '../binding';

describe('createUploadConsumer', () => {
    it('returns a Consumer instance', () => {
        const storageClient = {} as StorageClient;
        const amqpClient = {} as AmqpClient;
        const mediaDal = {} as MediaDal;
        const config: UploadConfig = {
            uploadBucket: 'bucket',
            uploadKeyPrefix: 'prefix',
            partSize: 128 * 1024 * 1024,
        };

        const consumer = createUploadConsumer(storageClient, amqpClient, mediaDal, config);

        expect(consumer).toBeInstanceOf(Consumer);
    });

    it('uses upload exchange and topic from binding constants', () => {
        expect(UPLOAD_CONSUMER_EXCHANGE).toBe('upload');
        expect(UPLOAD_CONSUMER_TOPIC).toBe('upload.media');
    });
});
