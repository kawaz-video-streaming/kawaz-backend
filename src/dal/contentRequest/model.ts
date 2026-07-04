import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";

export const contentRequestStatuses = ["requested", "acknowledged", "uploaded", "rejected", "failed"] as const;

export type ContentRequestStatus = typeof contentRequestStatuses[number];

export const contentRequestTerminalStatuses = ["uploaded", "rejected", "failed"] as const;

export type ContentRequestTerminalStatus = typeof contentRequestTerminalStatuses[number];

export const contentRequestMediaTypes = ["movie", "show"] as const;

export type ContentRequestMediaType = typeof contentRequestMediaTypes[number];

export interface ContentRequest {
    _id: string;
    username: string;
    tmdbId: number;
    mediaType: ContentRequestMediaType;
    title: string;
    year?: number;
    posterPath?: string | null;
    status: ContentRequestStatus;
    adminNote?: string;
    createdAt: Date;
    updatedAt: Date;
}

const contentRequestSchema = new Schema<ContentRequest>({
    _id: { type: String, required: true },
    username: { type: String, required: true },
    tmdbId: { type: Number, required: true },
    mediaType: { type: String, enum: contentRequestMediaTypes, required: true },
    title: { type: String, required: true },
    year: { type: Number },
    posterPath: { type: String },
    status: { type: String, enum: contentRequestStatuses, default: "requested" },
    adminNote: { type: String },
}, { timestamps: true });

export const createContentRequestModel = (client: MongoClient) =>
    client.createModel<ContentRequest>("contentRequest", contentRequestSchema);

export type ContentRequestModel = Model<ContentRequest>;
