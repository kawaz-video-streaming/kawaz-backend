import { Dal } from "@ido_kawaz/mongo-client";
import { Avatar, AvatarModel } from "./model";
import { isNil } from "ramda";

export class AvatarDal extends Dal<Avatar> {
    constructor(avatarModel: AvatarModel) {
        super(avatarModel);
    }

    createAvatar = (avatar: Avatar) =>
        this.model.insertOne(avatar);

    deleteAvatar = (id: string) =>
        this.model.findByIdAndDelete(id).exec();

    getAllAvatars = (): Promise<Avatar[]> =>
        this.model.find().lean<Avatar[]>().exec();

    getAvatarById = (id: string): Promise<Avatar | null> =>
        this.model.findById(id).lean<Avatar | null>().exec();

    isCategoryEmpty = async (categoryId: string): Promise<boolean> =>
        isNil(await this.model.exists({ categoryId }).lean().exec());
}