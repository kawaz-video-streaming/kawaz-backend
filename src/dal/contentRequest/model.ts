import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";

export const REQUESTED_STATUS = "requested" as const;
export const ACKNOWLEDGED_STATUS = "acknowledged" as const;
export const UPLOADED_STATUS = "uploaded" as const;
export const REJECTED_STATUS = "rejected" as const;
export const FAILED_STATUS = "failed" as const;

export const contentRequestStatuses = [
    REQUESTED_STATUS,
    ACKNOWLEDGED_STATUS,
    UPLOADED_STATUS,
    REJECTED_STATUS,
    FAILED_STATUS,
] as const;

export type ContentRequestStatus = typeof contentRequestStatuses[number];

export const contentRequestTerminalStatuses = [UPLOADED_STATUS, REJECTED_STATUS, FAILED_STATUS] as const;

export type ContentRequestTerminalStatus = typeof contentRequestTerminalStatuses[number];

export const contentRequestUpdatableStatuses = [ACKNOWLEDGED_STATUS, ...contentRequestTerminalStatuses] as const;

export type ContentRequestUpdatableStatus = typeof contentRequestUpdatableStatuses[number];

export const contentRequestMediaTypes = ["movie", "show", "season"] as const;

export type ContentRequestMediaType = typeof contentRequestMediaTypes[number];

export interface ContentRequest {
    _id: string;
    username: string;
    tmdbId: number;
    mediaType: ContentRequestMediaType;
    title: string;
    year?: number;
    seasonNumber?: number;
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
    seasonNumber: { type: Number },
    posterPath: { type: String },
    status: { type: String, enum: contentRequestStatuses, default: REQUESTED_STATUS },
    adminNote: { type: String },
}, { timestamps: true });

export const createContentRequestModel = (client: MongoClient) =>
    client.createModel<ContentRequest>("contentRequest", contentRequestSchema);

export type ContentRequestModel = Model<ContentRequest>;
