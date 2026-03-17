import { Consumer } from '@ido_kawaz/amqp-client';
import { MediaDal } from '../../../dal/media';
import { createProgressConsumer } from '../index';
import { PROGRESS_CONSUMER_EXCHANGE, PROGRESS_CONSUMER_TOPIC } from '../binding';

describe('createProgressConsumer', () => {
    it('returns a Consumer instance', () => {
        const mediaDal = {} as MediaDal;

        const consumer = createProgressConsumer(mediaDal);

        expect(consumer).toBeInstanceOf(Consumer);
    });

    it('uses progress exchange and topic from binding constants', () => {
        expect(PROGRESS_CONSUMER_EXCHANGE).toBe('progress');
        expect(PROGRESS_CONSUMER_TOPIC).toBe('progress.media');
    });
});
