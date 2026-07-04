import { NotFoundError } from "@ido_kawaz/server-framework";
import { isNil } from "ramda";
import { Dals } from "../../dal/types";
import { contentRequestTerminalStatuses } from "../../dal/contentRequest/model";
import { Mailer } from "../../services/mailer";
import { TmdbClient } from "../../services/tmdbClient";

const isTerminalStatus = (status: string): status is typeof contentRequestTerminalStatuses[number] =>
    (contentRequestTerminalStatuses as readonly string[]).includes(status);

export const createContentRequestLogic = (
    { contentRequestDal, userDal }: Dals,
    mailer: Mailer,
    tmdbClient: TmdbClient,
) => ({
    searchMovies: (title: string) => tmdbClient.searchMovies(title),
    searchShows: (title: string) => tmdbClient.searchShows(title),
    createRequest: (
        username: string,
        tmdbId: number,
        mediaType: "movie" | "show",
        title: string,
        year?: number,
        posterPath?: string | null,
    ) => contentRequestDal.createRequest(username, tmdbId, mediaType, title, year, posterPath),
    getMyRequests: (username: string) => contentRequestDal.getRequestsForUser(username),
    getAllRequests: () => contentRequestDal.getAllRequests(),
    updateStatus: async (id: string, status: "acknowledged" | "uploaded" | "rejected" | "failed", note?: string) => {
        const existingRequest = await contentRequestDal.getRequestById(id);
        if (isNil(existingRequest)) {
            throw new NotFoundError(`Content request with id ${id} not found`);
        }
        const updatedRequest = await contentRequestDal.updateRequestStatus(id, status, note);
        if (isTerminalStatus(status)) {
            const user = await userDal.findUser(existingRequest.username);
            if (user) {
                await mailer.sendContentRequestStatusEmail(user.email, existingRequest.title, status, note);
            }
        }
        return updatedRequest;
    },
});
