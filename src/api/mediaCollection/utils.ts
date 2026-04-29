import { isNil, isNotNil } from "ramda";
import { MediaCollectionDal } from "../../dal/mediaCollection";
import { BadRequestError } from "@ido_kawaz/server-framework";
import { MediaGenreDal } from "../../dal/mediaGenre";

export const validateMediaCollectionContainingCollectionAndGenre = async (mediaCollectionDal: MediaCollectionDal, mediaGenreDal: MediaGenreDal, genres: string[], kind: string, containingCollectionId?: string | null) => {
    const containingCollection = isNotNil(containingCollectionId) ? await mediaCollectionDal.getCollection(containingCollectionId) : null;
    if (isNotNil(containingCollectionId) && isNil(containingCollection)) {
        throw new BadRequestError("Parent collection not found");
    }
    if (kind === "season" && containingCollection?.kind !== "show") {
        throw new BadRequestError("A season must be nested inside a show");
    } else if (kind === "show" && isNotNil(containingCollection) && containingCollection.kind !== "collection") {
        throw new BadRequestError("A show can only be nested inside a generic collection");
    }
    await Promise.all(genres.map(async (genre) => {
        const genreExists = await mediaGenreDal.verifyGenreExists(genre);
        if (!genreExists) {
            throw new BadRequestError(`Genre with name ${genre} does not exist`);
        }
    }));
}