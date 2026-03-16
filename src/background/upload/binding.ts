import { createConsumerBinding } from "@ido_kawaz/amqp-client";

const UPLOAD_CONSUMER_QUEUE = 'kawaz-backend-upload'
export const UPLOAD_CONSUMER_EXCHANGE = 'upload'
export const UPLOAD_CONSUMER_TOPIC = 'upload.media'

export const createUploadConsumerBinding =
    () => createConsumerBinding(UPLOAD_CONSUMER_QUEUE, UPLOAD_CONSUMER_EXCHANGE, UPLOAD_CONSUMER_TOPIC);

export type UploadConsumerBinding = {
    queue: typeof UPLOAD_CONSUMER_QUEUE;
    exchange: typeof UPLOAD_CONSUMER_EXCHANGE;
    topic: typeof UPLOAD_CONSUMER_TOPIC;
}