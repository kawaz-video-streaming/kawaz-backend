import { MediaModel } from "./media";

export class MediaDal {
  constructor(private readonly mediaModel: MediaModel) { }

  createMedia = async (filename: string, contentType: string, size: number, uploadedAt?: Date) =>
    this.mediaModel.insertOne({
      filename,
      contentType,
      size,
      uploadedAt: uploadedAt ?? new Date()
    });
};

