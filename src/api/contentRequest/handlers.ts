import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Dals } from "../../dal/types";
import { Mailer } from "../../services/mailer";
import { TmdbClient } from "../../services/tmdbClient";
import { requestHandlerDecorator } from "../../utils/decorator";
import { AuthenticatedRequest } from "../../utils/types";
import { createContentRequestLogic } from "./logic";
import { validateCreateContentRequestRequest, validateTmdbMovieRequest, validateTmdbSeasonRequest, validateTmdbShowRequest, validateUpdateContentRequestStatusRequest } from "./types";

export const createContentRequestHandlers = (dals: Dals, mailer: Mailer, tmdbClient: TmdbClient) => {
    const contentRequestLogic = createContentRequestLogic(dals, mailer, tmdbClient);
    return {
        getMovieTmdbDetails: requestHandlerDecorator(
            "get tmdb movie details for content request",
            async (req: Request, res: Response) => {
                const { title, year } = validateTmdbMovieRequest(req);
                const details = await contentRequestLogic.getMovieTmdbDetails(title, year);
                res.status(StatusCodes.OK).json(details);
            }
        ),
        getShowTmdbDetails: requestHandlerDecorator(
            "get tmdb show details for content request",
            async (req: Request, res: Response) => {
                const { title, year } = validateTmdbShowRequest(req);
                const details = await contentRequestLogic.getShowTmdbDetails(title, year);
                res.status(StatusCodes.OK).json(details);
            }
        ),
        getSeasonTmdbDetails: requestHandlerDecorator(
            "get tmdb season details for content request",
            async (req: Request, res: Response) => {
                const { showTitle, showYear, seasonNumber } = validateTmdbSeasonRequest(req);
                const details = await contentRequestLogic.getSeasonTmdbDetails(showTitle, showYear, seasonNumber);
                res.status(StatusCodes.OK).json(details);
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
