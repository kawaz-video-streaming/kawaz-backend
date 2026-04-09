import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { UploadedFile } from "../../utils/types";
import { MediaCollectionConfig, MediaCollectionUpdateRequestBody } from "./types";
import { Dals } from "../../dal/types";
import { InternalServerError } from "@ido_kawaz/server-framework";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

class CollectionNotEmptyError extends InternalServerError {
  constructor() {
    super("Cannot delete collection that is not empty");
  }
}

export const createMediaCollectionLogic = (
  { uploadStorageBucket, uploadKeyPrefix }: MediaCollectionConfig,
  { mediaCollectionDal, mediaDal }: Dals,
  storageClient: StorageClient,
) => ({
  createMediaCollection: async (body: MediaCollectionUpdateRequestBody, thumbnail: UploadedFile) => {
    const collection = await mediaCollectionDal.createCollection(body);
    const thumbnailObject: StorageObject = { key: `${uploadKeyPrefix}/thumbnails/${collection._id}.jpg`, data: createReadStream(thumbnail.path) };
    await storageClient.uploadObject(uploadStorageBucket, thumbnailObject);
  },
  deleteMediaCollection: async (collectionId: string) => {
    const isCollectionEmptyFromMedia = await mediaDal.isCollectionEmpty(collectionId);
    const isCollectionEmptyFromSubcollections = await mediaCollectionDal.isCollectionEmpty(collectionId);
    if (!isCollectionEmptyFromMedia || !isCollectionEmptyFromSubcollections) {
      throw new CollectionNotEmptyError();
    }
    await mediaCollectionDal.deleteCollection(collectionId);
  },
  updateMediaCollection: async (collectionId: string, update: MediaCollectionUpdateRequestBody, thumbnail?: UploadedFile) => {
    await mediaCollectionDal.updateCollection(collectionId, update);
    if (thumbnail) {
      const thumbnailData = createReadStream(thumbnail.path);
      const thumbnailObject: StorageObject = { key: `${uploadKeyPrefix}/thumbnails/${collectionId}.jpg`, data: thumbnailData };
      await storageClient.uploadObject(uploadStorageBucket, thumbnailObject);
    }
  },
  getAllMediaCollections: () => mediaCollectionDal.getAllCollections(),
  getMediaCollection: (collectionId: string) => mediaCollectionDal.getCollection(collectionId),
  getThumbnail: (collectionId: string) => storageClient.getPresignedUrl(uploadStorageBucket, `${uploadKeyPrefix}/thumbnails/${collectionId}.jpg`, PRESIGNED_URL_EXPIRY_SECONDS)
});
