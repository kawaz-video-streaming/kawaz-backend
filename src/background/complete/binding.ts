import { createConsumerBinding } from "@ido_kawaz/amqp-client";

const COMPLETE_CONSUMER_QUEUE = 'kawaz-backend-complete'
export const COMPLETE_CONSUMER_EXCHANGE = 'complete'
export const COMPLETE_CONSUMER_TOPIC = 'complete.media'

export const createCompleteConsumerBinding =
    () => createConsumerBinding(COMPLETE_CONSUMER_QUEUE, COMPLETE_CONSUMER_EXCHANGE, COMPLETE_CONSUMER_TOPIC);

export type CompleteConsumerBinding = {
    queue: typeof COMPLETE_CONSUMER_QUEUE;
    exchange: typeof COMPLETE_CONSUMER_EXCHANGE;
    topic: typeof COMPLETE_CONSUMER_TOPIC;
}