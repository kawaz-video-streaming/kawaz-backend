import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";

export interface MediaGenre {
    _id: string;
    name: string;
}

const mediaGenreSchema = new Schema<MediaGenre>({
    _id: { type: String, required: true },
    name: { type: String, required: true, unique: true }
});

export const createMediaGenreModel = (client: MongoClient) =>
    client.createModel<MediaGenre>("mediaGenre", mediaGenreSchema);

export type MediaGenreModel = Model<MediaGenre>;