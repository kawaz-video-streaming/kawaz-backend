/**
 * Fixes generic subtitle titles ("Subtitle", "Track", etc.) in the DB by
 * replacing them with human-readable language names via Intl.DisplayNames.
 * Same-language tracks that still share a title are disambiguated with a
 * counter suffix (e.g. "English (2)").
 *
 * Run BEFORE deploying the subtitle management feature — or any time you
 * want to clean up legacy generic titles.
 *
 * Usage (from kawaz-backend/):
 *   npx ts-node-dev --env-file .env scripts/migrate-1-fix-subtitle-titles.ts --dry-run
 *   npx ts-node-dev --env-file .env scripts/migrate-1-fix-subtitle-titles.ts
 *
 * Requires: MONGO_CONNECTION_STRING
 */

import { createMongoConfig, MongoClient } from '@ido_kawaz/mongo-client';
import { createMediaModel } from '../src/dal/media/model';
import { createSpecialMediaModel } from '../src/dal/media/model';

const GENERIC_TITLES = new Set(['subtitle', 'track', 'unknown', '']);

const isGenericTitle = (title: string): boolean =>
    GENERIC_TITLES.has(title.trim().toLowerCase());

const titleFromLang = (lang: string, count: number): string => {
    let name: string;
    try { name = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) ?? lang.toUpperCase(); }
    catch { name = lang.toUpperCase(); }
    return count === 0 ? name : `${name} (${count + 1})`;
};

async function migrate(): Promise<void> {
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) console.log('[DRY RUN] No writes will be performed.\n');

    const mongoClient = new MongoClient(createMongoConfig());
    await mongoClient.start();

    const mediaColl = createMediaModel(mongoClient).collection;
    const specialMediaColl = createSpecialMediaModel(mongoClient).collection;

    let totalFixed = 0;
    let totalSkipped = 0;

    try {
        for (const [collectionName, col] of [['media', mediaColl], ['specialMedia', specialMediaColl]] as const) {
            const cursor = col.find({ status: 'completed', 'metadata.subtitleStreams.0': { $exists: true } });

            for await (const doc of cursor) {
                const streams: any[] = doc.metadata?.subtitleStreams ?? [];
                const needsFix = streams.some((s: any) => !s.title || isGenericTitle(s.title));
                if (!needsFix) { totalSkipped++; continue; }

                const langCount: Record<string, number> = {};
                const fixed = streams.map((s: any) => {
                    const lang = s.language ?? 'und';
                    const count = langCount[lang] ?? 0;
                    langCount[lang] = count + 1;
                    const generic = !s.title || isGenericTitle(s.title);
                    return { ...s, title: generic ? titleFromLang(lang, count) : s.title };
                });

                const fixedCount = streams.filter((s: any) => !s.title || isGenericTitle(s.title)).length;
                console.log(`[${isDryRun ? 'DRY RUN' : 'FIX'}] [${collectionName}] ${doc._id}: ${fixedCount} title(s) fixed`);
                if (!isDryRun) {
                    await col.updateOne({ _id: doc._id }, { $set: { 'metadata.subtitleStreams': fixed } });
                }
                totalFixed++;
            }
        }
    } finally {
        await mongoClient.stop();
    }

    console.log(`\nDone. Fixed: ${totalFixed}, Already clean: ${totalSkipped}`);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
