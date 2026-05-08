import { BadRequestError } from "@ido_kawaz/server-framework";
import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { MediaGenreDal } from "../../dal/mediaGenre";
import { cleanupPath } from "../../utils/files";
import { BucketsConfig, UploadedFile } from "../../utils/types";
import { MediaCollectionUpdateRequestBody } from "./types";
import { validateMediaCollectionContainingCollectionAndGenre } from "./utils";
import { MediaCollectionDal } from "../../dal/mediaCollection";
import { MediaDal } from "../../dal/media";

class CollectionNotEmptyError extends BadRequestError {
  constructor() {
    super("Cannot delete collection that is not empty");
  }
}

export const createMediaCollectionLogic = (
  { kawazPlus: { kawazStorageBucket, thumbnailPrefix } }: BucketsConfig,
  mediaGenreDal: MediaGenreDal,
  storageClient: StorageClient,
) => (mediaCollectionDal: MediaCollectionDal, mediaDal: MediaDal) => ({
  createMediaCollection: async (body: MediaCollectionUpdateRequestBody, thumbnail: UploadedFile) => {
    const { collectionId: containingCollectionId, kind, genres } = body;
    await validateMediaCollectionContainingCollectionAndGenre(mediaCollectionDal, mediaGenreDal, genres, kind, containingCollectionId);
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
    await storageClient.deleteObject(kawazStorageBucket, `${thumbnailPrefix}/${collectionId}.jpg`);
  },
  updateMediaCollection: async (collectionId: string, update: MediaCollectionUpdateRequestBody, thumbnail?: UploadedFile) => {
    const { collectionId: containingCollectionId, kind, genres } = update;
    await validateMediaCollectionContainingCollectionAndGenre(mediaCollectionDal, mediaGenreDal, genres, kind, containingCollectionId);
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
  getThumbnail: (collectionId: string) => storageClient.downloadObject(kawazStorageBucket, `${thumbnailPrefix}/${collectionId}.jpg`)
});
