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

// Watch progress

interface WatchProgressRequestBody {
    mediaId: string;
    positionInMs: number;
}

interface WatchProgressRequestParams {
    profileName: string;
}

export interface ValidatedWatchProgressRequest {
    body: WatchProgressRequestBody;
    params: WatchProgressRequestParams;
}

const validatedWatchProgressRequestSchema: z.ZodType<ValidatedWatchProgressRequest> = z.object({
    body: z.object({
        mediaId: z.string().min(1, "mediaId is required"),
        positionInMs: z.number().nonnegative("positionInMs must be non-negative"),
    }),
    params: z.object({
        profileName: z.string().min(1, "profileName is required"),
    }),
});

export const validateWatchProgressRequest = validateRequest(validatedWatchProgressRequestSchema);

// Profile + media params (used by progress DELETE, watchlist POST/DELETE)

interface ProfileMediaRequestParams {
    profileName: string;
    mediaId: string;
}

export interface ValidatedProfileMediaRequest {
    params: ProfileMediaRequestParams;
}

const validatedProfileMediaRequestSchema: z.ZodType<ValidatedProfileMediaRequest> = z.object({
    params: z.object({
        profileName: z.string().min(1, "profileName is required"),
        mediaId: z.string().min(1, "mediaId is required"),
    }),
});

export const validateProfileMediaRequest = validateRequest(validatedProfileMediaRequestSchema);

// Profile name param only (used by continue-watching GET, watchlist GET)

interface ProfileNameRequestParams {
    profileName: string;
}

export interface ValidatedProfileNameRequest {
    params: ProfileNameRequestParams;
}

const validatedProfileNameRequestSchema: z.ZodType<ValidatedProfileNameRequest> = z.object({
    params: z.object({
        profileName: z.string().min(1, "profileName is required"),
    }),
});

export const validateProfileNameRequest = validateRequest(validatedProfileNameRequestSchema);

// Response types

export interface ContinueWatchingItem {
    mediaId: string;
    positionInMs: number;
}