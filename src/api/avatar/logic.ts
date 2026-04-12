import { StorageClient, StorageObject } from "@ido_kawaz/storage-client";
import { createReadStream } from "fs";
import { AvatarDal } from "../../dal/avatar";
import { BucketsConfig, PRESIGNED_URL_EXPIRY_SECONDS, UploadedFile } from "../../utils/types";
import { Avatar } from "../../dal/avatar/model";

export const createAvatarLogic = (
    { kawazPlus: { kawazStorageBucket, avatarPrefix } }: BucketsConfig,
    avatarDal: AvatarDal,
    storageClient: StorageClient,
) => ({
    createAvatar: async (avatarMetadata: Avatar, avatarImage: UploadedFile) => {
        const avatar = await avatarDal.createAvatar(avatarMetadata);
        const avatarObject: StorageObject = { key: `${avatarPrefix}/${avatar._id}.jpg`, data: createReadStream(avatarImage.path) };
        await storageClient.uploadObject(kawazStorageBucket, avatarObject);
    },
    deleteAvatar: async (avatarId: string) => {
        await avatarDal.deleteAvatar(avatarId);
        await storageClient.deleteObject(kawazStorageBucket, `${avatarPrefix}/${avatarId}.jpg`);
    },
    getAllAvatars: () => avatarDal.getAllAvatars(),
    getAvatar: (avatarId: string) => avatarDal.getAvatarById(avatarId),
    getAvatarImage: (avatarId: string) => storageClient.getPresignedUrl(kawazStorageBucket, `${avatarPrefix}/${avatarId}.jpg`, PRESIGNED_URL_EXPIRY_SECONDS)
});
