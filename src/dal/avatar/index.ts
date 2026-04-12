import { Dal } from "@ido_kawaz/mongo-client";
import { Avatar, AvatarModel } from "./model";
import { AvatarCategory } from "../../utils/types";

export class AvatarDal extends Dal<Avatar> {
    constructor(avatarModel: AvatarModel) {
        super(avatarModel);
    }

    createAvatar = (name: string, category: AvatarCategory) =>
        this.model.insertOne({ name, category });

    deleteAvatar = (id: string) =>
        this.model.findByIdAndDelete(id).exec();

    getAllAvatars = (): Promise<Avatar[]> =>
        this.model.find().lean<Avatar[]>().exec();

    getAvatarById = (id: string): Promise<Avatar | null> =>
        this.model.findById(id).lean<Avatar | null>().exec();
}