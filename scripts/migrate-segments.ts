/**
 * Re-queues all completed videos for re-encoding with the current FFmpeg settings.
 *
 * Usage (from kawaz-backend/):
 *   npx ts-node-dev --env-file .env scripts/migrate-segments.ts --dry-run
 *   npx ts-node-dev --env-file .env scripts/migrate-segments.ts
 *
 * Requires: MONGO_CONNECTION_STRING, AMQP_CONNECTION_STRING,
 *           KAWAZ_PLUS_BUCKET, UPLOAD_PREFIX
 *
 * The 'convert' exchange must already exist in RabbitMQ (it is created
 * when media-processor starts its consumer).
 */

import { AmqpClient, createAmqpConfig } from '@ido_kawaz/amqp-client';
import { createMongoConfig, MongoClient } from '@ido_kawaz/mongo-client';
import { createMediaModel } from '../src/dal/media/model';
import type { ConvertMessage } from '../src/background/upload/types';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

async function migrate(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');

    const { KAWAZ_PLUS_BUCKET, UPLOAD_PREFIX } = process.env;
    if (!KAWAZ_PLUS_BUCKET) throw new Error('KAWAZ_PLUS_BUCKET is required');
    if (!UPLOAD_PREFIX) throw new Error('UPLOAD_PREFIX is required');

    const mongoClient = new MongoClient(createMongoConfig());
    const MediaModel = createMediaModel(mongoClient);
    await mongoClient.start();

    const amqpClient = new AmqpClient(createAmqpConfig());
    await amqpClient.start('migrate-segments');

    try {
        const completedMedia = await MediaModel
            .find({ status: 'completed' }, { _id: 1, fileName: 1 })
            .lean<{ _id: string; fileName: string }[]>()
            .exec();

        console.log(`Found ${completedMedia.length} completed video(s) to re-encode. dry-run=${isDryRun}\n`);

        for (let i = 0; i < completedMedia.length; i++) {
            const { _id, fileName } = completedMedia[i];

            const message: ConvertMessage = {
                mediaId: _id,
                mediaFileName: fileName,
                mediaStorageBucket: KAWAZ_PLUS_BUCKET,
                mediaRoutingKey: `${UPLOAD_PREFIX}/${fileName}`,
            };

            if (!isDryRun) {
                amqpClient.publish<ConvertMessage>('convert', 'convert.media', message);
            }

            console.log(`[${isDryRun ? 'DRY RUN' : 'QUEUED'}] ${i + 1}/${completedMedia.length}: ${_id} (${fileName})`);

            if ((i + 1) % BATCH_SIZE === 0) {
                await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
            }
        }

        console.log(`\n${isDryRun ? 'Would queue' : 'Queued'} ${completedMedia.length} re-encode job(s).`);
    } finally {
        await amqpClient.stop();
        await mongoClient.stop();
    }
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
