/**
 * Converts legacy Profile.watchlist entries (plain mediaId strings) to the
 * new shape ({ id, kind: "media" | "collection" }) introduced when the
 * watchlist feature was extended to support movies, shows, and top-level
 * collections instead of only movies.
 *
 * Also drops entries that are no longer eligible under the new rules:
 * episodes, seasons, nested collections, or ids that no longer exist.
 *
 * Run BEFORE deploying the watchlist-kinds feature — old and new code
 * disagree on the shape of Profile.watchlist.
 *
 * Usage (from kawaz-backend/):
 *   npx ts-node-dev --env-file .env scripts/migrate-5-watchlist-entries.ts --dry-run
 *   npx ts-node-dev --env-file .env scripts/migrate-5-watchlist-entries.ts
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
    let entriesKept = 0;
    let entriesDropped = 0;

    try {
        const users = await userColl.find({}).toArray();

        for (const user of users) {
            const profiles: any[] = (user as any).profiles ?? [];
            let userNeedsUpdate = false;

            const newProfiles = await Promise.all(profiles.map(async (profile) => {
                const rawWatchlist: unknown[] = profile.watchlist ?? [];
                const hasLegacyEntry = rawWatchlist.some(isLegacyEntry);
                if (!hasLegacyEntry) {
                    return profile;
                }
                userNeedsUpdate = true;

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

                return { ...profile, watchlist: resolved };
            }));

            if (userNeedsUpdate) {
                console.log(`[${isDryRun ? 'DRY RUN' : 'UPDATE'}] ${user.name}: migrating watchlist entries`);
                if (!isDryRun) {
                    await userColl.updateOne({ _id: user._id }, { $set: { profiles: newProfiles } });
                }
                usersUpdated++;
            }
        }

        console.log(`\nDone. Users updated: ${usersUpdated}, entries kept: ${entriesKept}, entries dropped: ${entriesDropped}`);

        if (isDryRun) {
            console.log('\n[DRY RUN] Skipping verification — no writes were made.');
            return;
        }

        console.log('\nVerifying...');
        const remaining = await userColl.countDocuments({ 'profiles.watchlist': { $type: 'string' } });
        if (remaining > 0) {
            console.error(`\nVERIFICATION FAILED: ${remaining} user doc(s) still have a legacy string watchlist entry`);
            process.exit(1);
        }
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
