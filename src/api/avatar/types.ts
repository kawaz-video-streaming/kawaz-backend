import z from "zod";
import { Avatar, avatarZodSchema } from "../../dal/avatar/model";
import { AuthenticatedRequest, UploadedFile, uploadedFileZodSchema } from "../../utils/types";
import { validateRequest } from "../../utils/zod";
import { AvatarDal } from "../../dal/avatar";

export interface AvatarCreationRequest {
    body: Avatar;
    avatarImage: UploadedFile;
}

export const avatarCreationRequestSchema: z.ZodType<AvatarCreationRequest> = z.object({
    body: avatarZodSchema,
    file: uploadedFileZodSchema('image/', 'Only image files are allowed')
}).transform(({ body, file }) => ({ body, avatarImage: file }));

export const validateAvatarCreationRequest = validateRequest(avatarCreationRequestSchema);

export interface AvatarAuthenticatedRequest extends AuthenticatedRequest {
    avatarDal: AvatarDal;
}