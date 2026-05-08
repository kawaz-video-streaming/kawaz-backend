import { Model, MongoClient, Schema, Types } from "@ido_kawaz/mongo-client";
import z from "zod";

export interface Avatar {
    name: string;
    categoryId: string;
}

export const avatarZodSchema: z.ZodType<Avatar> = z.object({
    name: z.string(),
    categoryId: z.string().refine((val) => Types.ObjectId.isValid(val), {
        message: "Invalid category ID",
    })
});

const avatarSchema = new Schema<Avatar>({
    name: { type: String, required: true },
    categoryId: { type: String, required: true }
});

export const createAvatarModel = (client: MongoClient) =>
    client.createModel<Avatar>('avatar', avatarSchema);

export const createSpecialAvatarModel = (client: MongoClient) =>
    client.createModel<Avatar>('specialAvatar', avatarSchema);

export type AvatarModel = Model<Avatar>;
