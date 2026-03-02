import { Dal } from "@ido_kawaz/mongo-client";
import { Media, MediaModel } from "./model";

export class MediaDal extends Dal<Media> {
  constructor(mediaModel: MediaModel) {
    super(mediaModel);
  }

  createMedia = async (filename: string, contentType: string, size: number) =>
    this.model.findOneAndUpdate(
      { filename },
      {
        filename,
        contentType,
        size
      },
      { upsert: true }
    );
};

