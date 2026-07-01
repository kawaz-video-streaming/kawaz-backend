/**
 * One-time migration for the KAN-9 watch-progress/watchlist feature.
 *
 * Combines what would otherwise be two sequential migrations into one pass:
 *   1. Backfills watchProgress ([]) and watchlist ([]) onto existing Profile
 *      subdocuments that predate the feature entirely.
 *   2. Converts any watchlist entries still in the legacy string (mediaId-only)
 *      shape to { id, kind: "media" | "collection" }, dropping entries that
 *      are no longer eligible (episodes, seasons, nested collections, or ids
 *      that no longer exist).
 *
 * Run BEFORE deploying the KAN-9 feature — old and new code disagree on the
 * shape of Profile.watchProgress/watchlist.
 *
 * Usage (from kawaz-backend/):
 *   npx ts-node-dev --env-file .env scripts/migrate-4-watchlist-and-progress-fields.ts --dry-run
 *   npx ts-node-dev --env-file .env scripts/migrate-4-watchlist-and-progress-fields.ts
 *
 * Requires: MONGO_CONNECTION_STRING
 */

import { createMongoConfig, MongoClient } from '@ido_kawaz/mongo-client';
import { createUserModel } from '../src/dal/user/model';
import { createMediaModel } from '../src/dal/media/model';
import { createMediaCollectionModel } from '../src/dal/mediaCollection/model';

interface WatchlistEntry {
    id: string;
    kind: 'media' | 'collection';
}

const isLegacyEntry = (entry: unknown): entry is string => typeof entry === 'string';

async function migrate(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) console.log('[DRY RUN] No writes will be performed.\n');

    const mongoClient = new MongoClient(createMongoConfig());
    await mongoClient.start();

    const userColl = createUserModel(mongoClient).collection;
    const mediaColl = createMediaModel(mongoClient).collection;
    const mediaCollectionColl = createMediaCollectionModel(mongoClient).collection;

    let usersUpdated = 0;
    let profilesBackfilled = 0;
    let entriesKept = 0;
    let entriesDropped = 0;

    try {
        const users = await userColl.find({}).toArray();

        for (const user of users) {
            const profiles: any[] = (user as any).profiles ?? [];
            let userNeedsUpdate = false;

            const newProfiles = await Promise.all(profiles.map(async (profile) => {
                const hasWatchProgress = 'watchProgress' in profile;
                const hasWatchlist = 'watchlist' in profile;
                const rawWatchlist: unknown[] = profile.watchlist ?? [];
                const hasLegacyEntry = rawWatchlist.some(isLegacyEntry);

                if (hasWatchProgress && hasWatchlist && !hasLegacyEntry) {
                    return profile;
                }
                userNeedsUpdate = true;

                if (!hasWatchProgress || !hasWatchlist) {
                    profilesBackfilled++;
                }

                const resolved: WatchlistEntry[] = [];
                for (const raw of rawWatchlist) {
                    if (!isLegacyEntry(raw)) {
                        // Already migrated shape — keep as-is.
                        resolved.push(raw as WatchlistEntry);
                        entriesKept++;
                        continue;
                    }

                    const media = await mediaColl.findOne({ _id: raw });
                    if (media && (media as any).kind === 'movie' && !(media as any).collectionId) {
                        resolved.push({ id: raw, kind: 'media' });
                        entriesKept++;
                        continue;
                    }

                    const collection = await mediaCollectionColl.findOne({ _id: raw });
                    if (collection && !(collection as any).collectionId) {
                        resolved.push({ id: raw, kind: 'collection' });
                        entriesKept++;
                        continue;
                    }

                    console.log(`  [DROP] ${user.name}/${profile.name}: watchlist entry "${raw}" is no longer eligible (episode, season, nested collection, or missing)`);
                    entriesDropped++;
                }

                return {
                    ...profile,
                    watchProgress: profile.watchProgress ?? [],
                    watchlist: resolved,
                };
            }));

            if (userNeedsUpdate) {
                console.log(`[${isDryRun ? 'DRY RUN' : 'UPDATE'}] ${user.name}: migrating profile watch fields`);
                if (!isDryRun) {
                    await userColl.updateOne({ _id: user._id }, { $set: { profiles: newProfiles } });
                }
                usersUpdated++;
            }
        }

        console.log(`\nDone. Users updated: ${usersUpdated}, profiles backfilled: ${profilesBackfilled}, watchlist entries kept: ${entriesKept}, dropped: ${entriesDropped}`);

        if (isDryRun) {
            console.log('\n[DRY RUN] Skipping verification — no writes were made.');
            return;
        }

        console.log('\nVerifying...');
        const errors: string[] = [];

        const remainingMissingWatchProgress = await userColl.countDocuments({ 'profiles.watchProgress': { $exists: false } });
        if (remainingMissingWatchProgress > 0)
            errors.push(`${remainingMissingWatchProgress} user doc(s) still have a profile missing "watchProgress"`);

        const remainingMissingWatchlist = await userColl.countDocuments({ 'profiles.watchlist': { $exists: false } });
        if (remainingMissingWatchlist > 0)
            errors.push(`${remainingMissingWatchlist} user doc(s) still have a profile missing "watchlist"`);

        const remainingLegacyEntries = await userColl.countDocuments({ 'profiles.watchlist': { $type: 'string' } });
        if (remainingLegacyEntries > 0)
            errors.push(`${remainingLegacyEntries} user doc(s) still have a legacy string watchlist entry`);

        if (errors.length > 0) {
            console.error('\nVERIFICATION FAILED:');
            errors.forEach(e => console.error(`  ✗ ${e}`));
            process.exit(1);
        }

        console.log('  ✓ Every profile has "watchProgress" and "watchlist" fields');
        console.log('  ✓ No profile has a legacy string watchlist entry');
        console.log('\nMigration complete.');
    } finally {
        await mongoClient.stop();
    }
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
