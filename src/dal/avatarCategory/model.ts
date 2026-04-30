import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";

export interface AvatarCategory {
    _id: string;
    name: string;
}

const avatarCategorySchema = new Schema<AvatarCategory>({
    _id: { type: String, required: true },
    name: { type: String, required: true, unique: true }
});

export const createAvatarCategoryModel = (client: MongoClient) =>
    client.createModel<AvatarCategory>("avatarCategory", avatarCategorySchema);

export type AvatarCategoryModel = Model<AvatarCategory>;