import { Model, MongoClient, Schema, Types } from "@ido_kawaz/mongo-client";

export const mediaResultStatuses = ["completed", "failed"] as const;

export type MediaResultStatus = typeof mediaResultStatuses[number];

export const mediaStatuses = ["pending", "processing", ...mediaResultStatuses] as const;

export type MediaStatus = typeof mediaStatuses[number];

export const PENDING: MediaStatus = 'pending';

export interface Media {
  _id: string;
  name: string;
  type: string;
  size: number;
  status: MediaStatus;
}

const mediaSchema = new Schema<Media>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toString() },
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    status: { type: String, enum: mediaStatuses, default: PENDING },
  },
  { versionKey: false },
);

export const createMediaModel = (client: MongoClient) => client.createModel("media", mediaSchema);

export type MediaModel = Model<Media>;
