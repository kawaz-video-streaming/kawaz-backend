import z from "zod";
import { Avatar, avatarZodSchema } from "../../dal/avatar/model";
import { UploadedFile, uploadedFileZodSchema } from "../../utils/types";
import { validateRequest } from "../../utils/zod";

export interface AvatarCreationRequest {
    body: Avatar;
    avatarImage: UploadedFile;
}

export const avatarCreationRequestSchema: z.ZodType<AvatarCreationRequest> = z.object({
    body: avatarZodSchema,
    file: uploadedFileZodSchema('image/', 'Only image files are allowed')
}).transform(({ body, file }) => ({ body, avatarImage: file }));

export const validateAvatarCreationRequest = validateRequest(avatarCreationRequestSchema);
