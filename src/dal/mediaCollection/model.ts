import { Model, MongoClient, Schema, Types } from "@ido_kawaz/mongo-client";
import { z } from "zod";
import { Coordinates, coordinatesSchema, MediaTag, MEDIA_TAGS } from "../../utils/types";

export interface MediaCollection {
    _id: string;
    title: string;
    description?: string;
    tags: MediaTag[];
    thumbnailFocalPoint: Coordinates;
    collectionId?: string; // Optional field if the collection is nested within another collection in the future
}

export interface MediaCollectionInfo extends Omit<MediaCollection, "_id" | "collectionId" | "description"> {
    description?: string | null;
    collectionId?: string | null;
}

export const mediaCollectionZodSchema = z.object({
    _id: z.string().refine((id) => Types.ObjectId.isValid(id), { message: "Invalid ObjectId" }),
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.enum(MEDIA_TAGS)).default([]),
    thumbnailFocalPoint: coordinatesSchema,
    collectionId: z.string().refine((id) => Types.ObjectId.isValid(id), { message: "Invalid ObjectId" }).optional()
});

const mediaCollectionSchema = new Schema<MediaCollection>({
    _id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: false },
    tags: { type: [String], enum: MEDIA_TAGS, default: [] },
    thumbnailFocalPoint: { type: coordinatesSchema, required: true },
    collectionId: { type: String, required: false }
});

export const createMediaCollectionModel = (client: MongoClient) =>
    client.createModel<MediaCollection>("mediaCollection", mediaCollectionSchema);

export type MediaCollectionModel = Model<MediaCollection>;