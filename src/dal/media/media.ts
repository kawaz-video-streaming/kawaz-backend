import { MongoClient, Schema, Model } from "@ido_kawaz/mongo-client";

export interface Media {
  filename: string;
  contentType: string;
  size: number;
}

const mediaSchema = new Schema<Media>(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false },
);

export const createMediaModel = (client: MongoClient) => client.createModel("Media", mediaSchema);

export type MediaModel = Model<Media>;
