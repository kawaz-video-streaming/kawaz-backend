import { Dal, Types, UpdateWriteOpResult } from "@ido_kawaz/mongo-client";
import { Media, MediaDocument, MediaModel, MediaStatus } from "./model";
import { isNotNil } from "ramda";

export class MediaDal extends Dal<Media> {
  constructor(mediaModel: MediaModel) {
    super(mediaModel);
  }

  createMedia = async (filename: string, contentType: string, size: number, includesSubtitles?: boolean): Promise<MediaDocument> =>
    this.model.findOneAndUpdate(
      { name: filename },
      {
        name: filename,
        type: contentType,
        size,
        ...(isNotNil(includesSubtitles) ? { includesSubtitles } : {})
      },
      { upsert: true, returnDocument: "after" }
    ).lean<MediaDocument>().exec();

  updateMediaStatus = async (mediaId: Types.ObjectId, status: MediaStatus): Promise<UpdateWriteOpResult> =>
    this.model.updateOne(
      { _id: mediaId },
      { status },
    ).lean().exec();
};

