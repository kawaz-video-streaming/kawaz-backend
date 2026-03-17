import { createConsumerBinding } from "@ido_kawaz/amqp-client";

const PROGRESS_CONSUMER_QUEUE = 'kawaz-backend-progress'
export const PROGRESS_CONSUMER_EXCHANGE = 'progress'
export const PROGRESS_CONSUMER_TOPIC = 'progress.media'

export const createProgressConsumerBinding =
    () => createConsumerBinding(PROGRESS_CONSUMER_QUEUE, PROGRESS_CONSUMER_EXCHANGE, PROGRESS_CONSUMER_TOPIC);

export type ProgressConsumerBinding = {
    queue: typeof PROGRESS_CONSUMER_QUEUE;
    exchange: typeof PROGRESS_CONSUMER_EXCHANGE;
    topic: typeof PROGRESS_CONSUMER_TOPIC;
}