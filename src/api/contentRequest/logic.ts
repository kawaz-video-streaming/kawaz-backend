import { NotFoundError } from "@ido_kawaz/server-framework";
import { isNil } from "ramda";
import { Dals } from "../../dal/types";
import { ContentRequestMediaType, ContentRequestUpdatableStatus } from "../../dal/contentRequest/model";
import { Mailer } from "../../services/mailer";
import { TmdbClient } from "../../services/tmdbClient";
import { buildDisplayTitle, isTerminalStatus } from "./utils";

export const createContentRequestLogic = (
    { contentRequestDal, userDal }: Dals,
    mailer: Mailer,
    tmdbClient: TmdbClient,
) => ({
    getMovieTmdbDetails: (title: string, year: number) => tmdbClient.getMovieDetails(title, year),
    getShowTmdbDetails: (title: string, year: number) => tmdbClient.getShowDetails(title, year),
    getSeasonTmdbDetails: (showTitle: string, showYear: number, seasonNumber: number) => tmdbClient.getSeasonDetails(showTitle, showYear, seasonNumber),
    createRequest: (
        username: string,
        tmdbId: number,
        mediaType: ContentRequestMediaType,
        title: string,
        year?: number,
        posterPath?: string | null,
        seasonNumber?: number,
    ) => contentRequestDal.createRequest(username, tmdbId, mediaType, title, year, posterPath, seasonNumber),
    getMyRequests: (username: string) => contentRequestDal.getRequestsForUser(username),
    getAllRequests: () => contentRequestDal.getAllRequests(),
    updateStatus: async (id: string, status: ContentRequestUpdatableStatus, note?: string) => {
        const existingRequest = await contentRequestDal.getRequestById(id);
        if (isNil(existingRequest)) {
            throw new NotFoundError(`Content request with id ${id} not found`);
        }
        const updatedRequest = await contentRequestDal.updateRequestStatus(id, status, note);
        if (isTerminalStatus(status)) {
            const user = await userDal.findUser(existingRequest.username);
            if (user) {
                await mailer.sendContentRequestStatusEmail(user.email, buildDisplayTitle(existingRequest), status, note);
            }
        }
        return updatedRequest;
    },
});
