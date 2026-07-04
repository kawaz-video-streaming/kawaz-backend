import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Dals } from "../../dal/types";
import { Mailer } from "../../services/mailer";
import { TmdbClient } from "../../services/tmdbClient";
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { createContentRequestLogic } from "./logic";
import { validateCreateContentRequestRequest, validateTmdbSearchRequest, validateUpdateContentRequestStatusRequest } from "./types";

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
        createRequest: requestHandlerDecorator(
            "create content request",
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const { tmdbId, mediaType, title, year, posterPath } = validateCreateContentRequestRequest(req);
                const request = await contentRequestLogic.createRequest(username, tmdbId, mediaType, title, year, posterPath);
                res.status(StatusCodes.CREATED).json(request);
            }
        ),
        getMyRequests: requestHandlerDecorator(
            "get my content requests",
            async (req: Request, res: Response) => {
                const { user: { username } } = req as AuthenticatedRequest;
                const requests = await contentRequestLogic.getMyRequests(username);
                res.status(StatusCodes.OK).json(requests);
            }
        ),
        getAllRequests: requestHandlerDecorator(
            "get all content requests",
            async (_req: Request, res: Response) => {
                const requests = await contentRequestLogic.getAllRequests();
                res.status(StatusCodes.OK).json(requests);
            }
        ),
        updateStatus: requestHandlerDecorator(
            "update content request status",
            async (req: Request, res: Response) => {
                const { id, status, note } = validateUpdateContentRequestStatusRequest(req);
                const request = await contentRequestLogic.updateStatus(id, status, note);
                res.status(StatusCodes.OK).json(request);
            }
        ),
    };
};
