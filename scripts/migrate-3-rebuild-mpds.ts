/**
 * Rebuilds and re-uploads output.mpd for every completed media that has
 * subtitle streams, injecting correct <Label> elements so Shaka Player can
 * distinguish same-language tracks. Safe to re-run; re-uploading identical
 * content is harmless.
 *
 * Run BEFORE deploying the subtitle management feature (after scripts 1 and 2).
 *
 * Usage (from kawaz-backend/):
 *   npx ts-node-dev --env-file .env scripts/migrate-3-rebuild-mpds.ts --dry-run
 *   npx ts-node-dev --env-file .env scripts/migrate-3-rebuild-mpds.ts
 *
 * Requires: MONGO_CONNECTION_STRING, VOD_STORAGE_BUCKET,
 *           AWS_ENDPOINT (or AWS_REGION), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */

import { createMongoConfig, MongoClient } from '@ido_kawaz/mongo-client';
import { StorageClient, createStorageConfig } from '@ido_kawaz/storage-client';
import { createMediaModel, createSpecialMediaModel } from '../src/dal/media/model';
import { Readable } from 'stream';

const streamToString = (stream: Readable): Promise<string> =>
    new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        stream.on('error', reject);
    });

const stripSubtitleSets = (mpd: string): string =>
    mpd.replace(/\t\t<AdaptationSet[^>]+contentType="text"[\s\S]*?<\/AdaptationSet>\n/g, '');

const escapeXml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const injectSubtitleSets = (stripped: string, streams: any[]): string => {
    const enabled = streams.filter((s: any) => s.enabled !== false && s.fileName && s.language && s.title);
    if (!enabled.length) return stripped;
    const maxId = Math.max(-1, ...[...stripped.matchAll(/id="(\d+)"/g)].map(m => parseInt(m[1])));
    const sets = enabled.map((s: any, i: number) => [
        `\t\t<AdaptationSet id="${maxId + 1 + i}" contentType="text" mimeType="text/vtt" lang="${escapeXml(s.language)}">`,
        `\t\t\t<Label>${escapeXml(s.title)}</Label>`,
        `\t\t\t<Role schemeIdUri="urn:mpeg:dash:role:2011" value="subtitle"/>`,
        `\t\t\t<Representation id="${maxId + 1 + i}" mimeType="text/vtt" codecs="wvtt">`,
        `\t\t\t\t<BaseURL>${escapeXml(s.fileName)}</BaseURL>`,
        `\t\t\t</Representation>`,
        `\t\t</AdaptationSet>`,
    ].join('\n')).join('\n');
    return stripped.replace(/\n\t<\/Period>/g, `\n${sets}\n\t</Period>`);
};

async function migrate(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) console.log('[DRY RUN] No S3 writes will be performed.\n');

    const vodBucket = process.env.VOD_STORAGE_BUCKET;
    if (!vodBucket) throw new Error('VOD_STORAGE_BUCKET is required');

    const mongoClient = new MongoClient(createMongoConfig());
    await mongoClient.start();

    const storage = new StorageClient(createStorageConfig());
    const mediaColl = createMediaModel(mongoClient).collection;
    const specialMediaColl = createSpecialMediaModel(mongoClient).collection;

    let totalRebuilt = 0;
    let totalFailed = 0;

    try {
        for (const [collectionName, col] of [['media', mediaColl], ['specialMedia', specialMediaColl]] as const) {
            const cursor = col.find({ status: 'completed', 'metadata.subtitleStreams.0': { $exists: true } });

            for await (const doc of cursor) {
                const mediaId = doc._id.toString();
                const streams: any[] = doc.metadata?.subtitleStreams ?? [];
                try {
                    const rawStream = await storage.downloadObject(vodBucket, `${mediaId}/output.mpd`);
                    const raw = await streamToString(rawStream);
                    const patched = injectSubtitleSets(stripSubtitleSets(raw), streams);
                    const enabledCount = streams.filter((s: any) => s.enabled !== false).length;
                    console.log(`[${isDryRun ? 'DRY RUN' : 'REBUILT'}] [${collectionName}] ${mediaId}: ${enabledCount} enabled subtitle(s)`);
                    if (!isDryRun) {
                        await storage.uploadObject(vodBucket, {
                            key: `${mediaId}/output.mpd`,
                            data: () => Readable.from(patched),
                        });
                    }
                    totalRebuilt++;
                } catch (err) {
                    totalFailed++;
                    console.error(`[FAILED] [${collectionName}] ${mediaId}:`, err);
                }
            }
        }
    } finally {
        await mongoClient.stop();
    }

    console.log(`\nDone. Rebuilt: ${totalRebuilt}, Failed: ${totalFailed}`);
    if (totalFailed > 0) process.exit(1);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
