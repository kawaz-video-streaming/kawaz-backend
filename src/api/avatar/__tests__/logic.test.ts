import { StorageClient } from '@ido_kawaz/storage-client';
import { AvatarDal } from '../../../dal/avatar';
import { Avatar } from '../../../dal/avatar/model';
import { BucketsConfig, UploadedFile } from '../../../utils/types';
import { createAvatarLogic } from '../logic';
import { Readable } from 'stream';

jest.mock('fs', () => ({ createReadStream: jest.fn().mockReturnValue({}) }));
jest.mock('fs/promises', () => ({ unlink: jest.fn().mockResolvedValue(undefined) }));

const makeBucketsConfig = (): BucketsConfig => ({
    kawazPlus: {
        kawazStorageBucket: 'kawaz-bucket',
        uploadPrefix: 'raw',
        thumbnailPrefix: 'raw/thumbnails',
        avatarPrefix: 'avatars',
    },
    vod: { vodStorageBucket: 'vod-bucket' },
});

const makeAvatarDal = (): jest.Mocked<Pick<AvatarDal, 'createAvatar' | 'deleteAvatar' | 'getAllAvatars' | 'getAvatarById'>> => ({
    createAvatar: jest.fn(),
    deleteAvatar: jest.fn().mockResolvedValue(undefined),
    getAllAvatars: jest.fn().mockResolvedValue([]),
    getAvatarById: jest.fn().mockResolvedValue(null),
});

const objectStream = Readable.from('https://presigned-url');

const makeStorageClient = (): jest.Mocked<Pick<StorageClient, 'uploadObject' | 'deleteObject' | 'downloadObject'>> => ({
    uploadObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    downloadObject: jest.fn().mockResolvedValue(objectStream),
});

const makeAvatar = (overrides: Partial<Avatar> = {}): Avatar => ({
    name: 'lion',
    category: 'Israel',
    ...overrides,
});

const makeImage = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
    path: '/tmp/avatar.jpg',
    fileName: 'avatar.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    ...overrides,
});

describe('createAvatarLogic.createAvatar', () => {
    it('persists the avatar and uploads its image to storage', async () => {
        const savedAvatar = { _id: 'av-1', name: 'lion', category: 'Israel' };
        const avatarDal = makeAvatarDal();
        avatarDal.createAvatar.mockResolvedValue(savedAvatar as any);
        const storageClient = makeStorageClient();

        const logic = createAvatarLogic(makeBucketsConfig(), avatarDal as unknown as AvatarDal, storageClient as unknown as StorageClient);
        await logic.createAvatar(makeAvatar(), makeImage());

        expect(avatarDal.createAvatar).toHaveBeenCalledTimes(1);
        expect(storageClient.uploadObject).toHaveBeenCalledWith(
            'kawaz-bucket',
            expect.objectContaining({ key: 'avatars/av-1.jpg' }),
        );
    });

    it('does not upload image if avatar creation fails', async () => {
        const avatarDal = makeAvatarDal();
        avatarDal.createAvatar.mockRejectedValue(new Error('db error'));
        const storageClient = makeStorageClient();

        const logic = createAvatarLogic(makeBucketsConfig(), avatarDal as unknown as AvatarDal, storageClient as unknown as StorageClient);
        await expect(logic.createAvatar(makeAvatar(), makeImage())).rejects.toThrow('db error');

        expect(storageClient.uploadObject).not.toHaveBeenCalled();
    });
});

describe('createAvatarLogic.deleteAvatar', () => {
    it('deletes avatar from DB and removes image from storage', async () => {
        const avatarDal = makeAvatarDal();
        const storageClient = makeStorageClient();

        const logic = createAvatarLogic(makeBucketsConfig(), avatarDal as unknown as AvatarDal, storageClient as unknown as StorageClient);
        await logic.deleteAvatar('av-1');

        expect(avatarDal.deleteAvatar).toHaveBeenCalledWith('av-1');
        expect(storageClient.deleteObject).toHaveBeenCalledWith('kawaz-bucket', 'avatars/av-1.jpg');
    });
});

describe('createAvatarLogic.getAllAvatars', () => {
    it('returns all avatars from DAL', async () => {
        const avatars = [{ name: 'lion', category: 'Israel' }, { name: 'bald eagle', category: 'United States' }];
        const avatarDal = makeAvatarDal();
        avatarDal.getAllAvatars.mockResolvedValue(avatars as any);
        const storageClient = makeStorageClient();

        const logic = createAvatarLogic(makeBucketsConfig(), avatarDal as unknown as AvatarDal, storageClient as unknown as StorageClient);
        const result = await logic.getAllAvatars();

        expect(result).toEqual(avatars);
    });
});

describe('createAvatarLogic.getAvatar', () => {
    it('returns avatar by id', async () => {
        const avatar = { _id: 'av-1', name: 'lion', category: 'Israel' };
        const avatarDal = makeAvatarDal();
        avatarDal.getAvatarById.mockResolvedValue(avatar as any);
        const storageClient = makeStorageClient();

        const logic = createAvatarLogic(makeBucketsConfig(), avatarDal as unknown as AvatarDal, storageClient as unknown as StorageClient);
        const result = await logic.getAvatar('av-1');

        expect(avatarDal.getAvatarById).toHaveBeenCalledWith('av-1');
        expect(result).toEqual(avatar);
    });

    it('returns null when avatar does not exist', async () => {
        const avatarDal = makeAvatarDal();
        const storageClient = makeStorageClient();

        const logic = createAvatarLogic(makeBucketsConfig(), avatarDal as unknown as AvatarDal, storageClient as unknown as StorageClient);
        const result = await logic.getAvatar('nonexistent');

        expect(result).toBeNull();
    });
});

describe('createAvatarLogic.getAvatarImage', () => {
    it('returns a stream of the avatar image', async () => {
        const avatarDal = makeAvatarDal();
        const storageClient = makeStorageClient();
        storageClient.downloadObject.mockResolvedValue(objectStream);

        const logic = createAvatarLogic(makeBucketsConfig(), avatarDal as unknown as AvatarDal, storageClient as unknown as StorageClient);
        const stream = await logic.getAvatarImage('av-1');

        expect(storageClient.downloadObject).toHaveBeenCalledWith('kawaz-bucket', 'avatars/av-1.jpg');
        expect(stream).toBe(objectStream);
    });
});
