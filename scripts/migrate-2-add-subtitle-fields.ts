/**
 * Backfills subtitleId, fileName and enabled onto existing subtitle stream
 * entries that predate the subtitle management feature. Filenames are derived
 * deterministically from the stream's position in the array and its language
 * code — matching what media-processor writes to S3.
 *
 * Run BEFORE deploying the subtitle management feature (after script 1).
 *
 * Usage (from kawaz-backend/):
 *   npx ts-node-dev --env-file .env scripts/migrate-2-add-subtitle-fields.ts --dry-run
 *   npx ts-node-dev --env-file .env scripts/migrate-2-add-subtitle-fields.ts
 *
 * Requires: MONGO_CONNECTION_STRING
 */

import { createMongoConfig, MongoClient } from '@ido_kawaz/mongo-client';
import { createMediaModel, createSpecialMediaModel } from '../src/dal/media/model';

async function migrate(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) console.log('[DRY RUN] No writes will be performed.\n');

    const mongoClient = new MongoClient(createMongoConfig());
    await mongoClient.start();

    const mediaColl = createMediaModel(mongoClient).collection;
    const specialMediaColl = createSpecialMediaModel(mongoClient).collection;

    let totalUpdated = 0;
    let totalSkipped = 0;

    try {
        for (const [collectionName, col] of [['media', mediaColl], ['specialMedia', specialMediaColl]] as const) {
            const cursor = col.find({ status: 'completed', 'metadata.subtitleStreams.0': { $exists: true } });

            for await (const doc of cursor) {
                const streams: any[] = doc.metadata?.subtitleStreams ?? [];
                const needsUpdate = streams.some((s: any) => !s.subtitleId);
                if (!needsUpdate) { totalSkipped++; continue; }

                const annotated = streams.map((s: any, i: number) => {
                    if (s.subtitleId) return s;
                    return {
                        ...s,
                        subtitleId: `subtitles_${i}_${s.language}`,
                        fileName: `subtitles_${i}_${s.language}.vtt`,
                        enabled: true,
                    };
                });

                const addedCount = streams.filter((s: any) => !s.subtitleId).length;
                console.log(`[${isDryRun ? 'DRY RUN' : 'UPDATE'}] [${collectionName}] ${doc._id}: annotated ${addedCount} subtitle(s)`);
                if (!isDryRun) {
                    await col.updateOne({ _id: doc._id }, { $set: { 'metadata.subtitleStreams': annotated } });
                }
                totalUpdated++;
            }
        }
    } finally {
        await mongoClient.stop();
    }

    console.log(`\nDone. Updated: ${totalUpdated}, Already annotated: ${totalSkipped}`);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
