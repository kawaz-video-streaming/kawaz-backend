import { InternalServerError } from "@ido_kawaz/server-framework";
import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { Dals } from "../../dal/types";
import { BucketsConfig, UploadedFile } from "../../utils/types";
import { MediaCollectionUpdateRequestBody } from "./types";
import { cleanupPath } from "../../utils/files";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

class CollectionNotEmptyError extends InternalServerError {
  constructor() {
    super("Cannot delete collection that is not empty");
  }
}

export const createMediaCollectionLogic = (
  { kawazPlus: { kawazStorageBucket, thumbnailPrefix } }: BucketsConfig,
  { mediaCollectionDal, mediaDal }: Dals,
  storageClient: StorageClient,
) => ({
  createMediaCollection: async (body: MediaCollectionUpdateRequestBody, thumbnail: UploadedFile) => {
    const collection = await mediaCollectionDal.createCollection(body);
    const thumbnailObject: StorageObject = { key: `${thumbnailPrefix}/${collection._id}.jpg`, data: createReadStream(thumbnail.path) };
    await storageClient.uploadObject(kawazStorageBucket, thumbnailObject);
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
      const thumbnailObject: StorageObject = { key: `${thumbnailPrefix}/${collectionId}.jpg`, data: thumbnailData };
      await storageClient.uploadObject(kawazStorageBucket, thumbnailObject);
      await cleanupPath(thumbnail.path);
    }
  },
  getAllMediaCollections: () => mediaCollectionDal.getAllCollections(),
  getMediaCollection: (collectionId: string) => mediaCollectionDal.getCollection(collectionId),
  getThumbnail: (collectionId: string) => storageClient.getPresignedUrl(kawazStorageBucket, `${thumbnailPrefix}/${collectionId}.jpg`, PRESIGNED_URL_EXPIRY_SECONDS)
});
