import { Dal, Types, UpdateWriteOpResult } from "@ido_kawaz/mongo-client";
import { Media, MediaModel, MediaStatus, PENDING } from "./model";

export class MediaDal extends Dal<Media> {
  constructor(mediaModel: MediaModel) {
    super(mediaModel);
  }

  createMedia = async (filename: string, contentType: string, size: number): Promise<Media> => {
    const media: Media = {
      _id: new Types.ObjectId().toString(),
      name: filename,
      type: contentType,
      size,
      status: PENDING,
    };
    await this.model.insertOne(media);
    return media;
  }

  updateMediaStatus = async (mediaId: string, status: MediaStatus): Promise<UpdateWriteOpResult> =>
    this.model.updateOne(
      { _id: mediaId },
      { status },
    ).lean().exec();
};

