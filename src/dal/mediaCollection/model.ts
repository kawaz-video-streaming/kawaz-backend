import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";
import { Coordinates, coordinatesSchema, MediaTag, MEDIA_TAGS, MediaCollectionKind, mediaCollectionKinds } from "../../utils/types";

export interface MediaCollection {
    _id: string;
    title: string;
    description?: string;
    kind: MediaCollectionKind;
    seasonNumber?: number;
    tags: MediaTag[];
    thumbnailFocalPoint: Coordinates;
    collectionId?: string; // Optional field if the collection is nested within another collection in the future
}

export interface MediaCollectionInfo extends Omit<MediaCollection, "_id" | "collectionId" | "seasonNumber" | "description"> {
    description?: string | null;
    seasonNumber?: number | null;
    collectionId?: string | null;
}

const mediaCollectionSchema = new Schema<MediaCollection>({
    _id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: false },
    kind: { type: String, enum: mediaCollectionKinds, required: true },
    seasonNumber: { type: Number, required: false },
    tags: { type: [String], enum: MEDIA_TAGS, default: [] },
    thumbnailFocalPoint: { type: coordinatesSchema, required: true },
    collectionId: { type: String, required: false }
});

export const createMediaCollectionModel = (client: MongoClient) =>
    client.createModel<MediaCollection>("mediaCollection", mediaCollectionSchema);

export type MediaCollectionModel = Model<MediaCollection>;