import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { AvatarDal } from "../../dal/avatar";
import { Avatar } from "../../dal/avatar/model";
import { cleanupPath } from "../../utils/files";
import { BucketsConfig, UploadedFile } from "../../utils/types";

export const createAvatarLogic = (
    { kawazPlus: { kawazStorageBucket, avatarPrefix } }: BucketsConfig,
    avatarDal: AvatarDal,
    storageClient: StorageClient,
) => ({
    createAvatar: async (avatarMetadata: Avatar, avatarImage: UploadedFile) => {
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
