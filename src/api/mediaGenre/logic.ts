import { BadRequestError, ConflictError, NotFoundError } from "@ido_kawaz/server-framework";
import { isNil } from "ramda";
import { Dals } from "../../dal/types";

export const createMediaGenreLogic = (
    { mediaDal, mediaGenreDal, mediaCollectionDal }: Dals
) => ({
    getAllGenres: () => mediaGenreDal.getAllGenres(),
    getGenre: async (genreId: string) => {
        const genre = await mediaGenreDal.getGenre(genreId);
        if (isNil(genre)) {
            throw new NotFoundError(`Media genre with id ${genreId} not found`);
        }
        return genre;
    },
    createGenre: async (name: string) => {
        try {
            await mediaGenreDal.createGenre(name);
        } catch (e) {
            if (e instanceof Error && e.message.includes("duplicate key error")) {
                throw new ConflictError(`Media genre with name ${name} already exists`);
            }
            throw e;
        }
    },
    deleteGenre: async (name: string) => {
        const isGenreEmptyFromMedias = await mediaDal.isGenreEmpty(name);
        const isGenreEmptyFromCollections = !(await mediaCollectionDal.isGenreUsedInCollection(name));
        if (!isGenreEmptyFromMedias || !isGenreEmptyFromCollections) {
            throw new BadRequestError(`Cannot delete genre with name ${name} because it has associated media or collections`);
        }
        await mediaGenreDal.deleteGenre(name);
    }
});