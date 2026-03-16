import { Model, MongoClient, Schema, Types } from "@ido_kawaz/mongo-client";

export const mediaStatuses = ["pending", "processing", "completed", "failed"] as const;

export type MediaStatus = typeof mediaStatuses[number];

export const PENDING: MediaStatus = 'pending';

export interface Media {
  _id: string;
  name: string;
  type: string;
  size: number;
  status: MediaStatus;
  includesSubtitles?: boolean;
}

const mediaSchema = new Schema<Media>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toString() },
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    status: { type: String, enum: mediaStatuses, default: PENDING },
    includesSubtitles: { type: Boolean, required: false },
  },
  { versionKey: false },
);

export const createMediaModel = (client: MongoClient) => client.createModel("Media", mediaSchema);

export type MediaModel = Model<Media>;
