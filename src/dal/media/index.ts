import { Dal, Types, UpdateWriteOpResult } from "@ido_kawaz/mongo-client";
import { COMPLETED, Media, MediaMetadata, MediaModel, MediaStatus, PENDING } from "./model";

export class MediaDal extends Dal<Media> {
  constructor(mediaModel: MediaModel) {
    super(mediaModel);
  }

  createMedia = async (filename: string, size: number): Promise<Media> => {
    const media: Media = { _id: new Types.ObjectId().toString(), name: filename, size, status: PENDING };
    await this.model.insertOne(media);
    return media;
  }

  getMedias = async (): Promise<Media[]> => this.model.find({ status: COMPLETED }).lean<Media[]>().exec();

  getMediaById = async (mediaId: string): Promise<Media | null> => this.model.findOne({ _id: mediaId, status: COMPLETED }).lean<Media>().exec();

  updateMediaStatus = async (mediaId: string, status: MediaStatus): Promise<UpdateWriteOpResult> =>
    this.model.updateOne({ _id: mediaId }, { status }).lean().exec();

  updateMediaMetadata = async (mediaId: string, metadata: MediaMetadata): Promise<UpdateWriteOpResult> =>
    this.model.updateOne({ _id: mediaId, status: COMPLETED }, { metadata }).lean().exec();
};

