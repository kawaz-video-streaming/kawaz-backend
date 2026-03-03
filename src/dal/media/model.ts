import { MongoClient, Schema, Model, Types } from "@ido_kawaz/mongo-client";

export const mediaStatuses = ["pending", "processing", "completed", "failed"] as const;

export type MediaStatus = typeof mediaStatuses[number];

export interface Media {
  name: string;
  type: string;
  size: number;
  status: MediaStatus;
  includesSubtitles?: boolean;
}

export interface MediaDocument extends Media {
  _id: Types.ObjectId;
}

const mediaSchema = new Schema<Media>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    status: { type: String, enum: mediaStatuses, default: "pending" },
    includesSubtitles: { type: Boolean, required: false },
  },
  { versionKey: false },
);

export const createMediaModel = (client: MongoClient) => client.createModel("Media", mediaSchema);

export type MediaModel = Model<Media>;
