import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Dals } from "../../dal/types";
import { Mailer } from "../../services/mailer";
import { TmdbClient } from "../../services/tmdbClient";
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { createContentRequestLogic } from "./logic";
import { validateCreateContentRequestRequest, validateTmdbSearchRequest, validateTmdbShowSeasonsRequest, validateUpdateContentRequestStatusRequest } from "./types";

export const createContentRequestHandlers = (dals: Dals, mailer: Mailer, tmdbClient: TmdbClient) => {
    const contentRequestLogic = createContentRequestLogic(dals, mailer, tmdbClient);
    return {
        searchMovies: requestHandlerDecorator(
            "search tmdb movies for content request",
            async (req: Request, res: Response) => {
                const { title } = validateTmdbSearchRequest(req);
                const results = await contentRequestLogic.searchMovies(title);
                res.status(StatusCodes.OK).json(results);
            }
        ),
        searchShows: requestHandlerDecorator(
            "search tmdb shows for content request",
            async (req: Request, res: Response) => {
                const { title } = validateTmdbSearchRequest(req);
                const results = await contentRequestLogic.searchShows(title);
                res.status(StatusCodes.OK).json(results);
            }
        ),
        getShowSeasons: requestHandlerDecorator(
            "get tmdb show seasons for content request",
            async (req: Request, res: Response) => {
                const { showId } = validateTmdbShowSeasonsRequest(req);
                const seasons = await contentRequestLogic.getShowSeasons(showId);
                res.status(StatusCodes.OK).json(seasons);
            }
        ),
        createRequest: requestHandlerDecorator(
            "create content request",
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const { tmdbId, mediaType, title, year, posterPath, seasonNumber } = validateCreateContentRequestRequest(req);
                const contentRequest = await contentRequestLogic.createRequest(username, tmdbId, mediaType, title, year, posterPath, seasonNumber);
                res.status(StatusCodes.CREATED).json(contentRequest);
            }
        ),
        getMyRequests: requestHandlerDecorator(
            "get my content requests",
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const contentRequests = await contentRequestLogic.getMyRequests(username);
                res.status(StatusCodes.OK).json(contentRequests);
            }
        ),
        getAllRequests: requestHandlerDecorator(
            "get all content requests",
            async (_req: Request, res: Response) => {
                const contentRequests = await contentRequestLogic.getAllRequests();
                res.status(StatusCodes.OK).json(contentRequests);
            }
        ),
        updateStatus: requestHandlerDecorator(
            "update content request status",
            async (req: Request, res: Response) => {
                const { id, status, note } = validateUpdateContentRequestStatusRequest(req);
                const contentRequest = await contentRequestLogic.updateStatus(id, status, note);
                res.status(StatusCodes.OK).json(contentRequest);
            }
        ),
    };
};
