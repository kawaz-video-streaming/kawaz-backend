import { Dal } from "@ido_kawaz/mongo-client";
import { MediaModel, Media } from "./media";

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

