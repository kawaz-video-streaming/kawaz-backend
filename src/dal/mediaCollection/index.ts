import { Dal, Types } from "@ido_kawaz/mongo-client";
import { isNil, isNotEmpty, isNotNil } from "ramda";
import { MediaCollection, MediaCollectionInfo, MediaCollectionModel } from "./model";

export class MediaCollectionDalError extends Error {
    constructor(message: string) {
        super(`error occured while accessing the MediaCollection Data Layer: ${message}`);
    }
}

export class MediaCollectionDal extends Dal<MediaCollection> {
    constructor(collectionModel: MediaCollectionModel) {
        super(collectionModel);
    }

    getAllCollections = async (): Promise<MediaCollection[]> =>
        this.model.find().lean<MediaCollection[]>().exec();

    getCollection = async (collectionId: string): Promise<MediaCollection | null> =>
        this.model.findById(collectionId).lean<MediaCollection>().exec();

    verifyCollectionExists = async (collectionId: string): Promise<boolean> =>
        isNotNil(await this.model.exists({ _id: collectionId }).lean().exec());

    createCollection = async (mediaCollectionInfo: MediaCollectionInfo): Promise<MediaCollection> => {
        const { title, description, tags, kind, seasonNumber, thumbnailFocalPoint, collectionId: containingCollectionId } = mediaCollectionInfo;
        const collection: MediaCollection = {
            _id: new Types.ObjectId().toString(),
            title,
            ...(isNotNil(description) && { description }),
            kind,
            ...(isNotNil(seasonNumber) && { seasonNumber }),
            tags,
            thumbnailFocalPoint,
            ...(isNotNil(containingCollectionId) && { collectionId: containingCollectionId })
        };
        await this.model.insertOne(collection);
        return collection;
    }

    updateCollection = async (collectionId: string, mediaCollectionInfo: Partial<MediaCollectionInfo>): Promise<void> => {
        const $set: Record<string, unknown> = {};
        const $unset: Record<string, ""> = {};

        Object.entries(mediaCollectionInfo).forEach(([key, value]) => {
            if (value === null) {
                $unset[key] = ""
            } else if (isNotNil(value)) {
                $set[key] = value;
            }
        });
        await this.model.findByIdAndUpdate(collectionId, { ...isNotEmpty(Object.keys($set)) && { $set }, ...isNotEmpty(Object.keys($unset)) && { $unset } }).lean().exec();
    }

    deleteCollection = async (collectionId: string) =>
        this.model.deleteOne({ _id: collectionId }).lean().exec();

    isCollectionEmpty = async (collectionId: string): Promise<boolean> =>
        isNil(await this.model.exists({ collectionId }).lean().exec());
}