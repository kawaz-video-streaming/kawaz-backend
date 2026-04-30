import { Types } from "@ido_kawaz/mongo-client";
import z from "zod";
import { validateRequest } from "../../utils/zod";

interface AvatarCategoryIdRequest {
    categoryId: string;
}

const avatarCategoryIdRequestBodyZodSchema = z.object({
    categoryId: z.string().refine((v) => Types.ObjectId.isValid(v), {
        message: "Invalid category ID",
    }),
}) satisfies z.ZodType<AvatarCategoryIdRequest>;

const avatarCategoryIdRequestZodSchema = z.object({
    params: avatarCategoryIdRequestBodyZodSchema
}).transform(({ params }) => params);

export const validateAvatarCategoryIdRequest = validateRequest(avatarCategoryIdRequestZodSchema);

interface AvatarCategoryCreationRequest {
    name: string;
}

const avatarCategoryCreationRequestBodyZodSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
}) satisfies z.ZodType<AvatarCategoryCreationRequest>;

const avatarCategoryCreationRequestZodSchema = z.object({
    body: avatarCategoryCreationRequestBodyZodSchema
}).transform(({ body }) => body);

export const validateAvatarCategoryCreationRequest = validateRequest(avatarCategoryCreationRequestZodSchema);