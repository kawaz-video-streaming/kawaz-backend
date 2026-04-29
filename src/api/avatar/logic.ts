import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { Avatar } from "../../dal/avatar/model";
import { Dals } from "../../dal/types";
import { cleanupPath } from "../../utils/files";
import { BucketsConfig, UploadedFile } from "../../utils/types";
import { BadRequestError } from "@ido_kawaz/server-framework";

export const createAvatarLogic = (
    { kawazPlus: { kawazStorageBucket, avatarPrefix } }: BucketsConfig,
    { avatarDal, avatarCategoryDal }: Dals,
    storageClient: StorageClient,
) => ({
    createAvatar: async (avatarMetadata: Avatar, avatarImage: UploadedFile) => {
        const categoryExists = await avatarCategoryDal.verifyCategoryExists(avatarMetadata.categoryId);
        if (!categoryExists) {
            throw new BadRequestError("Category assigned to avatar does not exist");
        }
        const avatar = await avatarDal.createAvatar(avatarMetadata);
        const avatarObject: StorageObject = { key: `${avatarPrefix}/${avatar._id}.jpg`, data: createReadStream(avatarImage.path) };
        await storageClient.uploadObject(kawazStorageBucket, avatarObject);
        await cleanupPath(avatarImage.path);
    },
    deleteAvatar: async (avatarId: string) => {
        await avatarDal.deleteAvatar(avatarId);
        await storageClient.deleteObject(kawazStorageBucket, `${avatarPrefix}/${avatarId}.jpg`);
    },
    getAllAvatars: () => avatarDal.getAllAvatars(),
    getAvatar: (avatarId: string) => avatarDal.getAvatarById(avatarId),
    getAvatarImage: (avatarId: string) => storageClient.downloadObject(kawazStorageBucket, `${avatarPrefix}/${avatarId}.jpg`)
});
