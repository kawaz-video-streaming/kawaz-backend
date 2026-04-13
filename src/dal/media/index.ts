import { Dal, DeleteResult, Types } from "@ido_kawaz/mongo-client";
import { isNil, isNotEmpty, isNotNil } from "ramda";
import { COMPLETED, Media, MediaInfo, MediaModel, MediaStatus, PENDING } from "./model";

export class MediaDal extends Dal<Media> {
  constructor(mediaModel: MediaModel) {
    super(mediaModel);
  }

  createMedia = async (mediaInfo: Omit<MediaInfo, "status" | "percentage">): Promise<Media> => {
    const { fileName, title, description, tags, size, thumbnailFocalPoint, collectionId } = mediaInfo;
    const media: Media = {
      _id: new Types.ObjectId().toString(),
      fileName,
      title,
      ...(isNotNil(description) && { description }),
      ...(isNotNil(collectionId) && { collectionId }),
      tags,
      size,
      status: PENDING,
      percentage: 10,
      thumbnailFocalPoint
    };
    await this.model.insertOne(media);
    return media;
  }

  deleteMedia = async (mediaId: string): Promise<DeleteResult> => this.model.deleteOne({ _id: mediaId }).lean().exec();

  updateMedia = async (mediaId: string, mediaInfo: Partial<MediaInfo>): Promise<void> => {
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};

    Object.entries(mediaInfo).forEach(([key, value]) => {
      if (value === null) {
        $unset[key] = ""
      } else if (isNotNil(value)) {
        $set[key] = value;
      }
    });

    await this.model.findByIdAndUpdate(mediaId, { ...isNotEmpty(Object.keys($set)) && { $set }, ...isNotEmpty(Object.keys($unset)) && { $unset } }).lean().exec();
  }

  getAllNoneCompletedMedia = async (): Promise<Media[]> => this.model.find({ status: { $ne: COMPLETED } }).lean<Media[]>().exec();

  getAllMedia = async (): Promise<Media[]> => this.model.find({ status: COMPLETED }).lean<Media[]>().exec();

  getMedia = async (mediaId: string): Promise<Media | null> => this.model.findOne({ _id: mediaId, status: COMPLETED }).lean<Media>().exec();

  getMediaUploadProgress = async (mediaId: string): Promise<{ status: MediaStatus, percentage: number }> => this.model
    .findOne({ _id: mediaId }, { status: 1, percentage: 1 })
    .lean<{ status: MediaStatus, percentage: number }>()
    .exec()
    .then(result => result ?? { status: PENDING, percentage: 0 });

  isCollectionEmpty = async (collectionId: string): Promise<boolean> =>
    isNil(await this.model.exists({ collectionId, status: COMPLETED }).lean().exec());
};

