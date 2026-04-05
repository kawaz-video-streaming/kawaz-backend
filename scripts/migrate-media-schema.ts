/**
 * Migration: Media schema v1 → v2
 *
 * Changes applied to each document in the `media` collection:
 *   - `name`  →  `fileName`  (rename)
 *   - `title` set to the value of the old `name` field (new required field)
 *   - `tags`  set to `[]` if absent  (new required field)
 *   - `metadata._id`   removed        (field dropped from MediaMetadata)
 *   - `metadata.title` → `metadata.name`  (field renamed in MediaMetadata)
 *
 * Usage:
 *   node --env-file .env node_modules/ts-node/dist/bin.js scripts/migrate-media-schema.ts
 *
 * Dry-run (no writes):
 *   DRY_RUN=true node --env-file .env node_modules/ts-node/dist/bin.js scripts/migrate-media-schema.ts
 */

import mongoose from 'mongoose';

const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
if (!MONGO_CONNECTION_STRING) {
    console.error('Missing MONGO_CONNECTION_STRING environment variable.');
    process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === 'true';

async function run() {
    console.log(`Connecting to MongoDB${DRY_RUN ? ' [DRY RUN]' : ''}…`);
    await mongoose.connect(MONGO_CONNECTION_STRING!);
    const db = mongoose.connection.db!;
    const collection = db.collection('media');

    const total = await collection.countDocuments();
    console.log(`Found ${total} document(s) in the media collection.`);

    let migrated = 0;
    let skipped = 0;

    const cursor = collection.find({});
    for await (const doc of cursor) {
        // Resolve fileName and title from old schema if needed
        const fileName: string = doc.fileName ?? doc.name;
        const title: string = doc.title ?? doc.name;

        // Resolve metadata, migrating title→name and dropping _id
        let metadata: Record<string, unknown> | undefined;
        if (doc.metadata) {
            const { _id: _metaId, title: metaTitle, ...rest } = doc.metadata;
            metadata = {
                name: doc.metadata.name ?? metaTitle,
                ...rest,
            };
        }

        // Build replacement in exact schema field order
        const replacement: Record<string, unknown> = { _id: doc._id };
        replacement['fileName'] = fileName;
        replacement['title'] = title;
        if (doc.description !== undefined) replacement['description'] = doc.description;
        replacement['tags'] = doc.tags ?? [];
        replacement['size'] = doc.size;
        replacement['status'] = doc.status;
        if (doc.thumbnailUrl !== undefined) replacement['thumbnailUrl'] = doc.thumbnailUrl;
        if (metadata !== undefined) replacement['metadata'] = metadata;

        console.log(`  [${doc._id}] ${JSON.stringify(replacement)}`);

        if (!DRY_RUN) {
            await collection.replaceOne({ _id: doc._id }, replacement);
        }
        migrated++;
    }

    console.log(`\nDone. Migrated: ${migrated}, already up-to-date: ${skipped}.`);
    await mongoose.disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
