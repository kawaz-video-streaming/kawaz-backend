import { Types } from "@ido_kawaz/mongo-client";
import z from "zod";
import { validateRequest } from "../../utils/zod";

interface UserProfileRequestBody {
    profileName: string;
    avatarId: string;
}

const userProfileRequestBodyZodSchema = z.object({
    profileName: z.string(),
    avatarId: z.string().refine((id) => Types.ObjectId.isValid(id), { message: "Invalid avatar ID format" })
}) satisfies z.ZodType<UserProfileRequestBody>;

export interface ValidatedUserProfileRequest {
    body: UserProfileRequestBody;
}

const ValidatedUserProfileRequestZodSchema: z.ZodType<ValidatedUserProfileRequest> = z.object({
    body: userProfileRequestBodyZodSchema
});

export const validateUserProfileRequest = validateRequest(ValidatedUserProfileRequestZodSchema);