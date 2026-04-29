import { BadRequestError } from '@ido_kawaz/server-framework';
import { StorageClient } from '@ido_kawaz/storage-client';
import { Readable } from 'stream';
import { AvatarDal } from '../../../dal/avatar';
import { MediaDal } from '../../../dal/media';
import { MediaCollectionDal } from '../../../dal/mediaCollection';
import { Dals } from '../../../dal/types';
import { UserDal } from '../../../dal/user';
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
    tags: [],
    thumbnailFocalPoint: { x: 0.5, y: 0.5 },
    ...overrides,
});

const makeDals = (overrides: Partial<Dals> = {}): Dals => ({
    mediaCollectionDal: {
        createCollection: jest.fn(),
        deleteCollection: jest.fn(),
        updateCollection: jest.fn(),
        getAllCollections: jest.fn(),
        getCollection: jest.fn(),
        isCollectionEmpty: jest.fn().mockResolvedValue(true),
    } as unknown as MediaCollectionDal,
    mediaDal: {
        isCollectionEmpty: jest.fn().mockResolvedValue(true),
    } as unknown as MediaDal,
    userDal: {} as unknown as UserDal,
    avatarDal: {} as unknown as AvatarDal,
    ...overrides,
});

const objectStream = Readable.from('https://presigned-url');

const makeStorageClient = (): jest.Mocked<Pick<StorageClient, 'uploadObject' | 'downloadObject' | 'deleteObject'>> => ({
    uploadObject: jest.fn().mockResolvedValue(undefined),
    downloadObject: jest.fn().mockResolvedValue(objectStream),
    deleteObject: jest.fn().mockResolvedValue(undefined),
});

describe('createMediaCollectionLogic.createMediaCollection', () => {
    it('creates collection and uploads thumbnail to storage', async () => {
        const collection = { _id: 'col-1', title: 'My Collection', tags: [], thumbnailFocalPoint: { x: 0.5, y: 0.5 } };
        const dals = makeDals();
        (dals.mediaCollectionDal.createCollection as jest.Mock).mockResolvedValue(collection);
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        await logic.createMediaCollection(makeBody(), makeThumbnail());

        expect(dals.mediaCollectionDal.createCollection).toHaveBeenCalledTimes(1);
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'upload-bucket',
            expect.objectContaining({ key: 'raw/thumbnails/col-1.jpg' }),
        );
    });

    it('does not upload thumbnail if collection creation fails', async () => {
        const dals = makeDals();
        (dals.mediaCollectionDal.createCollection as jest.Mock).mockRejectedValue(new Error('db error'));
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        await expect(logic.createMediaCollection(makeBody(), makeThumbnail())).rejects.toThrow('db error');

        expect(storageClient.uploadObject).not.toHaveBeenCalled();
    });
});

describe('createMediaCollectionLogic.deleteMediaCollection', () => {
    it('deletes collection and its thumbnail when both media and subcollections are empty', async () => {
        const dals = makeDals();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        await logic.deleteMediaCollection('col-1');

        expect(dals.mediaCollectionDal.deleteCollection).toHaveBeenCalledWith('col-1');
        expect(storageClient.deleteObject).toHaveBeenCalledWith('upload-bucket', 'raw/thumbnails/col-1.jpg');
    });

    it('throws when collection still contains media', async () => {
        const dals = makeDals({
            mediaDal: {
                isCollectionEmpty: jest.fn().mockResolvedValue(false),
            } as unknown as MediaDal,
        });
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        await expect(logic.deleteMediaCollection('col-1')).rejects.toBeInstanceOf(BadRequestError);

        expect(dals.mediaCollectionDal.deleteCollection).not.toHaveBeenCalled();
    });

    it('throws when collection still contains subcollections', async () => {
        const dals = makeDals({
            mediaCollectionDal: {
                isCollectionEmpty: jest.fn().mockResolvedValue(false),
                deleteCollection: jest.fn(),
            } as unknown as MediaCollectionDal,
        });
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        await expect(logic.deleteMediaCollection('col-1')).rejects.toBeInstanceOf(BadRequestError);

        expect(dals.mediaCollectionDal.deleteCollection).not.toHaveBeenCalled();
    });
});

describe('createMediaCollectionLogic.updateMediaCollection', () => {
    it('updates collection without uploading thumbnail when none provided', async () => {
        const dals = makeDals();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        await logic.updateMediaCollection('col-1', makeBody());

        expect(dals.mediaCollectionDal.updateCollection).toHaveBeenCalledWith('col-1', makeBody());
        expect(storageClient.uploadObject).not.toHaveBeenCalled();
    });

    it('uploads thumbnail when one is provided', async () => {
        const dals = makeDals();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        await logic.updateMediaCollection('col-1', makeBody(), makeThumbnail());

        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'upload-bucket',
            expect.objectContaining({ key: 'raw/thumbnails/col-1.jpg' }),
        );
    });
});

describe('createMediaCollectionLogic.getThumbnail', () => {
    it('returns presigned URL for the collection thumbnail', async () => {
        const dals = makeDals();
        const storageClient = makeStorageClient();

        const logic = createMediaCollectionLogic(makeConfig(), dals, storageClient as unknown as StorageClient);
        const stream = await logic.getThumbnail('col-1');

        expect(storageClient.downloadObject).toHaveBeenCalledWith('upload-bucket', 'raw/thumbnails/col-1.jpg');
        expect(stream).toBe(objectStream);
    });
});
