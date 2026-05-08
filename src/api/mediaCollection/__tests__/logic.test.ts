import { BadRequestError } from '@ido_kawaz/server-framework';
import { StorageClient } from '@ido_kawaz/storage-client';
import { Readable } from 'stream';
import { MediaDal } from '../../../dal/media';
import { MediaCollectionDal } from '../../../dal/mediaCollection';
import { MediaGenreDal } from '../../../dal/mediaGenre';
import { UploadedFile } from '../../../utils/types';
import { createMediaCollectionLogic } from '../logic';
import { MediaCollectionUpdateRequestBody } from '../types';

jest.mock('fs', () => ({ createReadStream: jest.fn().mockReturnValue({}) }));
jest.mock('fs/promises', () => ({ unlink: jest.fn().mockResolvedValue(undefined) }));

const makeConfig = () => ({
    kawazPlus: {
        kawazStorageBucket: 'upload-bucket',
        uploadPrefix: 'raw',
        thumbnailPrefix: 'raw/thumbnails',
        avatarPrefix: 'avatars',
    },
    vod: { vodStorageBucket: 'vod-bucket' },
});

const makeThumbnail = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
    path: '/tmp/thumb.jpg',
    fileName: 'thumb.jpg',
    mimetype: 'image/jpeg',
    size: 8,
    ...overrides,
});

const makeBody = (overrides: Partial<MediaCollectionUpdateRequestBody> = {}): MediaCollectionUpdateRequestBody => ({
    title: 'My Collection',
    kind: 'collection',
    genres: [],
    thumbnailFocalPoint: { x: 0.5, y: 0.5 },
    ...overrides,
});

const makeMediaCollectionDal = (overrides: Partial<jest.Mocked<MediaCollectionDal>> = {}) => ({
    createCollection: jest.fn(),
    deleteCollection: jest.fn(),
    updateCollection: jest.fn(),
    getAllCollections: jest.fn(),
    getCollection: jest.fn(),
    isCollectionEmpty: jest.fn().mockResolvedValue(true),
    ...overrides,
} as unknown as MediaCollectionDal);

const makeMediaDal = (overrides: Partial<jest.Mocked<MediaDal>> = {}) => ({
    isCollectionEmpty: jest.fn().mockResolvedValue(true),
    ...overrides,
} as unknown as MediaDal);

const makeMediaGenreDal = (overrides: Partial<jest.Mocked<MediaGenreDal>> = {}) => ({
    verifyGenreExists: jest.fn().mockResolvedValue(true),
    ...overrides,
} as unknown as MediaGenreDal);

const objectStream = Readable.from('https://presigned-url');

const makeStorageClient = (): jest.Mocked<Pick<StorageClient, 'uploadObject' | 'downloadObject' | 'deleteObject'>> => ({
    uploadObject: jest.fn().mockResolvedValue(undefined),
    downloadObject: jest.fn().mockResolvedValue(objectStream),
    deleteObject: jest.fn().mockResolvedValue(undefined),
});

describe('createMediaCollectionLogic.createMediaCollection', () => {
    it('creates collection and uploads thumbnail to storage', async () => {
        const collection = { _id: 'col-1', title: 'My Collection', genres: [], thumbnailFocalPoint: { x: 0.5, y: 0.5 } };
        const mediaCollectionDal = makeMediaCollectionDal({ createCollection: jest.fn().mockResolvedValue(collection) });
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await logic.createMediaCollection(makeBody(), makeThumbnail());

        expect(mediaCollectionDal.createCollection).toHaveBeenCalledTimes(1);
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'upload-bucket',
            expect.objectContaining({ key: 'raw/thumbnails/col-1.jpg' }),
        );
    });

    it('does not upload thumbnail if collection creation fails', async () => {
        const mediaCollectionDal = makeMediaCollectionDal({ createCollection: jest.fn().mockRejectedValue(new Error('db error')) });
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await expect(logic.createMediaCollection(makeBody(), makeThumbnail())).rejects.toThrow('db error');

        expect(storageClient.uploadObject).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when a referenced genre does not exist', async () => {
        const mediaCollectionDal = makeMediaCollectionDal();
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal({ verifyGenreExists: jest.fn().mockResolvedValue(false) }), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await expect(logic.createMediaCollection(makeBody({ genres: ['NonExistent'] }), makeThumbnail())).rejects.toThrow('does not exist');

        expect(mediaCollectionDal.createCollection).not.toHaveBeenCalled();
        expect(storageClient.uploadObject).not.toHaveBeenCalled();
    });
});

describe('createMediaCollectionLogic.deleteMediaCollection', () => {
    it('deletes collection and its thumbnail when both media and subcollections are empty', async () => {
        const mediaCollectionDal = makeMediaCollectionDal();
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await logic.deleteMediaCollection('col-1');

        expect(mediaCollectionDal.deleteCollection).toHaveBeenCalledWith('col-1');
        expect(storageClient.deleteObject).toHaveBeenCalledWith('upload-bucket', 'raw/thumbnails/col-1.jpg');
    });

    it('throws when collection still contains media', async () => {
        const mediaCollectionDal = makeMediaCollectionDal();
        const mediaDal = makeMediaDal({ isCollectionEmpty: jest.fn().mockResolvedValue(false) });
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await expect(logic.deleteMediaCollection('col-1')).rejects.toBeInstanceOf(BadRequestError);

        expect(mediaCollectionDal.deleteCollection).not.toHaveBeenCalled();
    });

    it('throws when collection still contains subcollections', async () => {
        const mediaCollectionDal = makeMediaCollectionDal({ isCollectionEmpty: jest.fn().mockResolvedValue(false) });
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await expect(logic.deleteMediaCollection('col-1')).rejects.toBeInstanceOf(BadRequestError);

        expect(mediaCollectionDal.deleteCollection).not.toHaveBeenCalled();
    });
});

describe('createMediaCollectionLogic.updateMediaCollection', () => {
    it('updates collection without uploading thumbnail when none provided', async () => {
        const mediaCollectionDal = makeMediaCollectionDal();
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await logic.updateMediaCollection('col-1', makeBody());

        expect(mediaCollectionDal.updateCollection).toHaveBeenCalledWith('col-1', makeBody());
        expect(storageClient.uploadObject).not.toHaveBeenCalled();
    });

    it('uploads thumbnail when one is provided', async () => {
        const mediaCollectionDal = makeMediaCollectionDal();
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await logic.updateMediaCollection('col-1', makeBody(), makeThumbnail());

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'upload-bucket',
            expect.objectContaining({ key: 'raw/thumbnails/col-1.jpg' }),
        );
    });
});

describe('createMediaCollectionLogic.getThumbnail', () => {
    it('returns thumbnail stream when collection exists in pool', async () => {
        const collection = { _id: 'col-1', title: 'My Collection', genres: [] };
        const mediaCollectionDal = makeMediaCollectionDal({ getCollection: jest.fn().mockResolvedValue(collection) });
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        const stream = await logic.getThumbnail('col-1');

        expect(storageClient.downloadObject).toHaveBeenCalledWith('upload-bucket', 'raw/thumbnails/col-1.jpg');
        expect(stream).toBe(objectStream);
    });

    it('throws NotFoundError and does not hit storage when collection is not in pool', async () => {
        const mediaCollectionDal = makeMediaCollectionDal();
        const mediaDal = makeMediaDal();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), makeMediaGenreDal(), storageClient as unknown as StorageClient)(mediaCollectionDal, mediaDal);
        await expect(logic.getThumbnail('col-1')).rejects.toThrow('Media collection not found');

        expect(storageClient.downloadObject).not.toHaveBeenCalled();
    });
});
