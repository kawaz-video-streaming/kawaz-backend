import { Dal, DeleteResult, Types, UpdateWriteOpResult } from "@ido_kawaz/mongo-client";
import { COMPLETED, Coordinates, Media, MediaModel, MediaTag, PENDING } from "./model";

export class MediaDal extends Dal<Media> {
  constructor(mediaModel: MediaModel) {
    super(mediaModel);
  }

  createMedia = async (title: string, tags: MediaTag[], fileName: string, size: number, thumbnailFocalPoint: Coordinates, description?: string): Promise<Media> => {
    const media: Media = {
      _id: new Types.ObjectId().toString(),
      fileName,
      title,
      ...(description && { description }),
      tags,
      size,
      status: PENDING,
      thumbnailFocalPoint
    };
    await this.model.insertOne(media);
    return media;
  }

  deleteMedia = async (mediaId: string): Promise<DeleteResult> => this.model.deleteOne({ _id: mediaId }).lean().exec();

  updateMedia = async (mediaId: string, update: Partial<Media>): Promise<UpdateWriteOpResult> =>
    this.model.updateOne({ _id: mediaId }, { ...update }).lean().exec();

  getAllMedia = async (): Promise<Media[]> => this.model.find({ status: COMPLETED }).lean<Media[]>().exec();

  getMedia = async (mediaId: string): Promise<Media | null> => this.model.findOne({ _id: mediaId, status: COMPLETED }).lean<Media>().exec();
};

