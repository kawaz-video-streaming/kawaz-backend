import { Dal, Types } from "@ido_kawaz/mongo-client";
import { MediaGenre, MediaGenreModel } from "./model";
import { isNotNil } from "ramda";

export class MediaGenreDal extends Dal<MediaGenre> {
    constructor(model: MediaGenreModel) {
        super(model);
    }

    getAllGenres = async (): Promise<MediaGenre[]> =>
        this.model.find().lean<MediaGenre[]>().exec();

    getGenre = async (genreId: string): Promise<MediaGenre | null> =>
        this.model.findById(genreId).lean<MediaGenre>().exec();

    verifyGenreExists = async (name: string): Promise<boolean> =>
        isNotNil(await this.model.exists({ name }).lean().exec());

    createGenre = async (name: string): Promise<MediaGenre> => {
        const genre: MediaGenre = {
            _id: new Types.ObjectId().toString(),
            name
        };
        await this.model.insertOne(genre);
        return genre;
    }

    deleteGenre = async (name: string) =>
        this.model.findOneAndDelete({ name }).exec();
}