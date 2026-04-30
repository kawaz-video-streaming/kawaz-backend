import { isNil, isNotNil } from "ramda";
import { MediaCollectionDal } from "../../dal/mediaCollection";
import { BadRequestError } from "@ido_kawaz/server-framework";
import { MediaGenreDal } from "../../dal/mediaGenre";

export const validateMediaContainingCollectionAndGenre = async (mediaCollectionDal: MediaCollectionDal, mediaGenreDal: MediaGenreDal, genres: string[], kind: string, containingCollectionId?: string | null) => {
    const containingCollection = isNil(containingCollectionId) ? null : await mediaCollectionDal.getCollection(containingCollectionId);
    if (isNotNil(containingCollectionId) && isNil(containingCollection)) {
        throw new BadRequestError("Parent collection not found");
    }
    if (kind === 'episode' && containingCollection?.kind !== "season") {
        throw new BadRequestError("An episode must belong to a season");
    } else if (kind === "movie" && isNotNil(containingCollection) && containingCollection.kind !== "collection") {
        throw new BadRequestError("Movies can only be contained within a general collection if at all");
    }
    await Promise.all(genres.map(async (genre) => {
        const genreExists = await mediaGenreDal.verifyGenreExists(genre);
        if (!genreExists) {
            throw new BadRequestError(`Genre with name ${genre} does not exist`);
        }
    }));
}
