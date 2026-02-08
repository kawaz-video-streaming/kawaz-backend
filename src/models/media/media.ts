import mongoose, { Schema, Model } from "mongoose";

export interface Media {
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

const mediaSchema = new Schema<Media>(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export type MediaModel = Model<Media>;

export const createMediaModel = (): MediaModel =>
  mongoose.model<Media>("media", mediaSchema);
