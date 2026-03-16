import { Consumer } from '@ido_kawaz/amqp-client';
import { MediaDal } from '../../../dal/media';
import { createCompleteConsumer } from '../index';
import { COMPLETE_CONSUMER_EXCHANGE, COMPLETE_CONSUMER_TOPIC } from '../binding';

describe('createCompleteConsumer', () => {
    it('returns a Consumer instance', () => {
        const mediaDal = {} as MediaDal;

        const consumer = createCompleteConsumer(mediaDal);

        expect(consumer).toBeInstanceOf(Consumer);
    });

    it('uses complete exchange and topic from binding constants', () => {
        expect(COMPLETE_CONSUMER_EXCHANGE).toBe('complete');
        expect(COMPLETE_CONSUMER_TOPIC).toBe('complete.media');
    });
});
