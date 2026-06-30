import { NotFoundError } from "@ido_kawaz/server-framework";
import { isNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { UserDal } from "../../dal/user";
import { FINISHED_THRESHOLD_MS } from "./consts";
import { ContinueWatchingItem } from "./types";

export const createUserLogic = (userDal: UserDal) => (mediaDal: MediaDal) => ({
    upsertWatchProgress: async (username: string, profileName: string, mediaId: string, positionInMs: number): Promise<void> => {
        const success = await userDal.upsertWatchProgress(username, profileName, mediaId, positionInMs);
        if (!success) {
            throw new NotFoundError("Profile not found");
        }
    },

    removeWatchProgress: (username: string, profileName: string, mediaId: string) =>
        userDal.removeWatchProgress(username, profileName, mediaId),

    getContinueWatching: async (username: string, profileName: string): Promise<ContinueWatchingItem[]> => {
        const profile = await userDal.getProfile(username, profileName);
        if (isNil(profile)) {
            return [];
        }
        const resolved = await Promise.all(
            profile.watchProgress.map(async ({ mediaId, positionInMs, updatedAt }) => {
                const durationInMs = await mediaDal.getMediaDuration(mediaId);
                return { mediaId, positionInMs, updatedAt, durationInMs };
            })
        );
        return resolved
            .filter(({ durationInMs, positionInMs }) => {
                if (isNil(durationInMs)) {
                    return false;
                }
                return positionInMs < durationInMs - FINISHED_THRESHOLD_MS;
            })
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map(({ mediaId, positionInMs }) => ({ mediaId, positionInMs }));
    },

    addToWatchlist: (username: string, profileName: string, mediaId: string) =>
        userDal.addToWatchlist(username, profileName, mediaId),

    removeFromWatchlist: (username: string, profileName: string, mediaId: string) =>
        userDal.removeFromWatchlist(username, profileName, mediaId),

    getWatchlist: async (username: string, profileName: string): Promise<string[]> => {
        const profile = await userDal.getProfile(username, profileName);
        if (isNil(profile)) {
            return [];
        }
        return profile.watchlist;
    },
});
