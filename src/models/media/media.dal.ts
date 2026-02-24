import { MediaModel } from "./media";

export class MediaDal {
  constructor(private readonly mediaModel: MediaModel) { }

  createMedia = async (filename: string, contentType: string, size: number) =>
    this.mediaModel.findOneAndUpdate(
      { filename },
      {
        filename,
        contentType,
        size
      },
      { upsert: true }
    );
};

