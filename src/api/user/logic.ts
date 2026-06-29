import { NotFoundError } from "@ido_kawaz/server-framework";
import { isNil, isNotNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { Media } from "../../dal/media/model";
import { UserDal } from "../../dal/user";
import { ContinueWatchingItem } from "./types";

const FINISHED_THRESHOLD = 0.9;

export const createUserLogic = (userDal: UserDal) => (mediaDal: MediaDal) => ({
    upsertWatchProgress: async (username: string, profileName: string, mediaId: string, positionInMs: number): Promise<void> => {
        const success = await userDal.upsertWatchProgress(username, profileName, mediaId, positionInMs);
        if (!success) {
            throw new NotFoundError("Profile not found");
        }
    },

    removeWatchProgress: async (username: string, profileName: string, mediaId: string): Promise<void> => {
        await userDal.removeWatchProgress(username, profileName, mediaId);
    },

    getContinueWatching: async (username: string, profileName: string): Promise<ContinueWatchingItem[]> => {
        const profile = await userDal.getProfile(username, profileName);
        if (isNil(profile)) {
            return [];
        }
        const resolved = await Promise.all(
            profile.watchProgress.map(async ({ mediaId, positionInMs, updatedAt }) => {
                const media = await mediaDal.getMedia(mediaId);
                return { media, positionInMs, updatedAt };
            })
        );
        return resolved
            .filter((item): item is { media: Media; positionInMs: number; updatedAt: Date } => isNotNil(item.media))
            .filter(({ media, positionInMs }) => {
                const durationInMs = media.metadata?.durationInMs;
                if (isNil(durationInMs)) { return true; }
                return positionInMs < durationInMs * FINISHED_THRESHOLD;
            })
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map(({ media, positionInMs }) => ({ ...media, positionInMs }));
    },

    addToWatchlist: async (username: string, profileName: string, mediaId: string): Promise<void> => {
        await userDal.addToWatchlist(username, profileName, mediaId);
    },

    removeFromWatchlist: async (username: string, profileName: string, mediaId: string): Promise<void> => {
        await userDal.removeFromWatchlist(username, profileName, mediaId);
    },

    getWatchlist: async (username: string, profileName: string): Promise<Media[]> => {
        const profile = await userDal.getProfile(username, profileName);
        if (isNil(profile)) {
            return [];
        }
        const resolved = await Promise.all(profile.watchlist.map((id) => mediaDal.getMedia(id)));
        return resolved.filter((m): m is Media => isNotNil(m));
    },
});
