import { BadRequestError, NotFoundError } from "@ido_kawaz/server-framework";
import { isNil, isNotNil } from "ramda";
import { MediaDal } from "../../dal/media";
import { MediaCollectionDal } from "../../dal/mediaCollection";
import { UserDal } from "../../dal/user";
import { WatchlistEntry, WatchlistItemKind } from "../../dal/user/model";
import { FINISHED_THRESHOLD_MS } from "./consts";
import { ContinueWatchingItem } from "./types";

export const createUserLogic = (userDal: UserDal) => (mediaDal: MediaDal, mediaCollectionDal: MediaCollectionDal) => ({
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

    addToWatchlist: async (username: string, profileName: string, id: string, kind: WatchlistItemKind): Promise<void> => {
        if (kind === "media") {
            const media = await mediaDal.getMedia(id);
            if (isNil(media)) {
                throw new NotFoundError("Media not found");
            }
            if (media.kind !== "movie" || isNotNil(media.collectionId)) {
                throw new BadRequestError("Only top-level movies can be added to the watchlist");
            }
        } else {
            const collection = await mediaCollectionDal.getCollection(id);
            if (isNil(collection)) {
                throw new NotFoundError("Collection not found");
            }
            if (isNotNil(collection.collectionId)) {
                throw new BadRequestError("Only top-level shows or collections can be added to the watchlist");
            }
        }
        await userDal.addToWatchlist(username, profileName, id, kind);
    },

    removeFromWatchlist: (username: string, profileName: string, id: string, kind: WatchlistItemKind) =>
        userDal.removeFromWatchlist(username, profileName, id, kind),

    getWatchlist: async (username: string, profileName: string): Promise<WatchlistEntry[]> => {
        const profile = await userDal.getProfile(username, profileName);
        if (isNil(profile)) {
            return [];
        }
        return profile.watchlist;
    },
});
