/**
 * One-time migration for DB refactor (Feature #7).
 *
 * Run BEFORE deploying the new backend — old and new code are not compatible
 * on the same database state.
 *
 * Steps:
 *   1. Seed MediaGenre from the old hardcoded MEDIA_TAGS list; rename Media.tags
 *      and MediaCollection.tags to .genres.
 *   2. Seed AvatarCategory from the old hardcoded AVATAR_CATEGORIES list; migrate
 *      Avatar.category (string) to Avatar.categoryId (ObjectId ref).
 *   3. Backfill kind="collection" on MediaCollection docs and kind="movie" on
 *      Media docs that have no kind field yet.
 *   4. Verify — exits with code 1 if any assertion fails.
 *
 * Usage (from kawaz-backend/):
 *   npx ts-node-dev --env-file .env scripts/migrate-db-refactor.ts --dry-run
 *   npx ts-node-dev --env-file .env scripts/migrate-db-refactor.ts
 *
 * Requires: MONGO_CONNECTION_STRING
 */

import { createMongoConfig, MongoClient, Types } from '@ido_kawaz/mongo-client';
import { createMediaModel } from '../src/dal/media/model';
import { createMediaCollectionModel } from '../src/dal/mediaCollection/model';
import { createMediaGenreModel } from '../src/dal/mediaGenre/model';
import { createAvatarModel } from '../src/dal/avatar/model';
import { createAvatarCategoryModel } from '../src/dal/avatarCategory/model';

// ── Hardcoded source-of-truth values that existed before this refactor ─────────

const MEDIA_TAGS = [
    "Action",
    "Fantasy",
    "Adventure",
    "Superhero",
    "Anime",
    "Animation",
    "Comedy",
    "Parody",
    "Crime",
    "Documentary",
    "Drama",
    "Education",
    "Horror",
    "Kids",
    "Music",
    "News",
    "Romance",
    "Sci-Fi",
    "Sport",
    "Thriller",
] as const;

const AVATAR_CATEGORIES = [
    "United Kingdom",
    "United States",
    "Israel",
    "Japan",
    "France",
] as const;

// ─────────────────────────────────────────────────────────────────────────────

async function migrate(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) console.log('[DRY RUN] No writes will be performed.\n');

    const mongoClient = new MongoClient(createMongoConfig());
    await mongoClient.start();

    const MediaModel = createMediaModel(mongoClient);
    const MediaCollectionModel = createMediaCollectionModel(mongoClient);
    const MediaGenreModel = createMediaGenreModel(mongoClient);
    const AvatarModel = createAvatarModel(mongoClient);
    const AvatarCategoryModel = createAvatarCategoryModel(mongoClient);

    // Raw MongoDB collections (bypass Mongoose schema for $rename and legacy fields)
    const mediaColl = MediaModel.collection;
    const mediaCollectionColl = MediaCollectionModel.collection;
    const mediaGenreColl = MediaGenreModel.collection;
    const avatarColl = AvatarModel.collection;
    const avatarCategoryColl = AvatarCategoryModel.collection;

    try {
        // ── Step 1: Seed MediaGenre; rename tags → genres ────────────────────────

        console.log('Step 1: Seeding MediaGenre and renaming tags → genres...');

        for (const name of MEDIA_TAGS) {
            const existing = await mediaGenreColl.findOne({ name });
            if (existing) {
                console.log(`  [SKIP] MediaGenre "${name}" already exists`);
                continue;
            }
            const doc = { _id: new Types.ObjectId().toString(), name };
            if (!isDryRun) await mediaGenreColl.insertOne(doc as any);
            console.log(`  [${isDryRun ? 'DRY RUN' : 'INSERT'}] MediaGenre "${name}"`);
        }

        const mediaTagsCount = await mediaColl.countDocuments({ tags: { $exists: true } });
        console.log(`\n  Found ${mediaTagsCount} Media docs with "tags" field`);
        if (mediaTagsCount > 0 && !isDryRun) {
            const result = await mediaColl.updateMany({ tags: { $exists: true } }, { $rename: { tags: 'genres' } } as any);
            console.log(`  Renamed tags→genres in ${result.modifiedCount} Media docs`);
        }

        const collTagsCount = await mediaCollectionColl.countDocuments({ tags: { $exists: true } });
        console.log(`  Found ${collTagsCount} MediaCollection docs with "tags" field`);
        if (collTagsCount > 0 && !isDryRun) {
            const result = await mediaCollectionColl.updateMany({ tags: { $exists: true } }, { $rename: { tags: 'genres' } } as any);
            console.log(`  Renamed tags→genres in ${result.modifiedCount} MediaCollection docs`);
        }

        // ── Step 2: Seed AvatarCategory; migrate Avatar.category → categoryId ──

        console.log('\nStep 2: Seeding AvatarCategory and migrating Avatar.category → categoryId...');

        const categoryMap = new Map<string, string>();

        for (const name of AVATAR_CATEGORIES) {
            const existing = await avatarCategoryColl.findOne({ name });
            let categoryId: string;
            if (existing) {
                console.log(`  [SKIP] AvatarCategory "${name}" already exists (id=${existing._id})`);
                categoryId = existing._id.toString();
            } else {
                const id = new Types.ObjectId().toString();
                const doc = { _id: id, name };
                if (!isDryRun) await avatarCategoryColl.insertOne(doc as any);
                console.log(`  [${isDryRun ? 'DRY RUN' : 'INSERT'}] AvatarCategory "${name}"`);
                categoryId = id;
            }
            categoryMap.set(name, categoryId);
        }

        const avatarsToMigrate = await avatarColl.find({ category: { $exists: true } }).toArray();
        console.log(`\n  Found ${avatarsToMigrate.length} Avatar docs with legacy "category" field`);

        let migrated = 0;
        let skipped = 0;
        for (const avatar of avatarsToMigrate) {
            const categoryId = categoryMap.get(avatar.category as string);
            if (!categoryId) {
                console.warn(`  [WARN] Avatar ${avatar._id} has unknown category "${avatar.category}" — skipping`);
                skipped++;
                continue;
            }
            if (!isDryRun) {
                await avatarColl.updateOne(
                    { _id: avatar._id },
                    { $set: { categoryId }, $unset: { category: '' } } as any
                );
            }
            console.log(`  [${isDryRun ? 'DRY RUN' : 'MIGRATED'}] Avatar ${avatar._id}: category="${avatar.category}" → categoryId="${categoryId}"`);
            migrated++;
        }
        if (skipped > 0) console.warn(`  [WARN] Skipped ${skipped} Avatar docs with unrecognised category values`);

        // ── Step 3: Backfill kind defaults ────────────────────────────────────

        console.log('\nStep 3: Backfilling kind defaults on documents with no kind field...');

        const collWithoutKind = await mediaCollectionColl.countDocuments({ kind: { $exists: false } });
        console.log(`  Found ${collWithoutKind} MediaCollection docs with no "kind"`);
        if (collWithoutKind > 0 && !isDryRun) {
            const r = await mediaCollectionColl.updateMany({ kind: { $exists: false } }, { $set: { kind: 'collection' } });
            console.log(`  Set kind="collection" on ${r.modifiedCount} MediaCollection docs`);
        }

        const mediaWithoutKind = await mediaColl.countDocuments({ kind: { $exists: false } });
        console.log(`  Found ${mediaWithoutKind} Media docs with no "kind"`);
        if (mediaWithoutKind > 0 && !isDryRun) {
            const r = await mediaColl.updateMany({ kind: { $exists: false } }, { $set: { kind: 'movie' } });
            console.log(`  Set kind="movie" on ${r.modifiedCount} Media docs`);
        }

        // ── Step 4: Verify ────────────────────────────────────────────────────

        if (isDryRun) {
            console.log('\n[DRY RUN] Skipping verification — no writes were made.');
            return;
        }

        console.log('\nStep 4: Verifying...');
        const errors: string[] = [];

        const remainingMediaTags = await mediaColl.countDocuments({ tags: { $exists: true } });
        if (remainingMediaTags > 0)
            errors.push(`${remainingMediaTags} Media docs still have a "tags" field`);

        const remainingCollTags = await mediaCollectionColl.countDocuments({ tags: { $exists: true } });
        if (remainingCollTags > 0)
            errors.push(`${remainingCollTags} MediaCollection docs still have a "tags" field`);

        const remainingAvatarCategory = await avatarColl.countDocuments({ category: { $exists: true } });
        if (remainingAvatarCategory > 0)
            errors.push(`${remainingAvatarCategory} Avatar docs still have a "category" field`);

        const remainingMediaWithoutKind = await mediaColl.countDocuments({ kind: { $exists: false } });
        if (remainingMediaWithoutKind > 0)
            errors.push(`${remainingMediaWithoutKind} Media docs have no "kind" field`);

        const remainingCollWithoutKind = await mediaCollectionColl.countDocuments({ kind: { $exists: false } });
        if (remainingCollWithoutKind > 0)
            errors.push(`${remainingCollWithoutKind} MediaCollection docs have no "kind" field`);

        const genreCount = await mediaGenreColl.countDocuments();
        if (genreCount !== MEDIA_TAGS.length)
            errors.push(`Expected ${MEDIA_TAGS.length} MediaGenre docs, found ${genreCount}`);

        const catCount = await avatarCategoryColl.countDocuments();
        if (catCount !== AVATAR_CATEGORIES.length)
            errors.push(`Expected ${AVATAR_CATEGORIES.length} AvatarCategory docs, found ${catCount}`);

        if (errors.length > 0) {
            console.error('\nVERIFICATION FAILED:');
            errors.forEach(e => console.error(`  ✗ ${e}`));
            process.exit(1);
        }

        console.log('  ✓ No Media or MediaCollection docs have a "tags" field');
        console.log('  ✓ No Avatar docs have a "category" field');
        console.log('  ✓ Every Media and MediaCollection doc has a "kind" field');
        console.log(`  ✓ MediaGenre count = ${genreCount}`);
        console.log(`  ✓ AvatarCategory count = ${catCount}`);
        console.log('\nMigration complete.');
    } finally {
        await mongoClient.stop();
    }
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
