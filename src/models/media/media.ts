import mongoose, { Schema, Model } from "mongoose";

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

export type MediaModel = Model<Media>;

export const createMediaModel = (connection: mongoose.Connection): MediaModel =>
  connection.model<Media>("media", mediaSchema);
