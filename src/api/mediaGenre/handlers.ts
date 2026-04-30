import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Dals } from "../../dal/types";
import { requestHandlerDecorator } from "../../utils/decorator";
import { createMediaGenreLogic } from "./logic";
import { validateMediaGenreNamedRequest, validateMediaGenreIdRequest } from "./types";

export const createMediaGenreHandlers = (
    dals: Dals
) => {
    const mediaGenreLogic = createMediaGenreLogic(dals);
    return {
        getAllGenres: requestHandlerDecorator(
            "get all media genres",
            async (_req: Request, res: Response) => {
                const genres = await mediaGenreLogic.getAllGenres();
                res.status(StatusCodes.OK).json(genres);
            }
        ),
        getGenre: requestHandlerDecorator(
            "get media genre by id",
            async (req: Request, res: Response) => {
                const { genreId } = validateMediaGenreIdRequest(req);
                const genre = await mediaGenreLogic.getGenre(genreId);
                res.status(StatusCodes.OK).json(genre);
            }
        ),
        createGenre: requestHandlerDecorator(
            "create media genre",
            async (req: Request, res: Response) => {
                const { name } = validateMediaGenreNamedRequest(req);
                await mediaGenreLogic.createGenre(name);
                res.status(StatusCodes.CREATED).json({ message: "Media genre created successfully" });
            }
        ),
        deleteGenre: requestHandlerDecorator(
            "delete media genre",
            async (req: Request, res: Response) => {
                const { name } = validateMediaGenreNamedRequest(req);
                await mediaGenreLogic.deleteGenre(name);
                res.status(StatusCodes.OK).json({ message: "Media genre deleted successfully" });
            }
        )
    }
}