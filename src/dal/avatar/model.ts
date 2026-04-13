import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";
import { AVATAR_CATEGORIES, AvatarCategory } from "../../utils/types";
import z from "zod";

export interface Avatar {
    name: string;
    category: AvatarCategory;
}

export const avatarZodSchema: z.ZodType<Avatar> = z.object({
    name: z.string(),
    category: z.enum(AVATAR_CATEGORIES)
});

const avatarSchema = new Schema<Avatar>({
    name: { type: String, required: true },
    category: { type: String, required: true, enum: AVATAR_CATEGORIES }
});

export const createAvatarModel = (client: MongoClient) =>
    client.createModel<Avatar>('avatar', avatarSchema);

export type AvatarModel = Model<Avatar>;