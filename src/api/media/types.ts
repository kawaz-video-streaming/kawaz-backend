import z from "zod";
import { Coordinates, MEDIA_TAGS, MediaTag, RequestWithIdParam, requestWithIdParamZodSchema, UploadedFile, uploadedFileZodSchema } from "../../utils/types";
import { validateRequest } from "../../utils/zod";

export interface MediaConfig {
    vodStorageBucket: string;
    uploadStorageBucket: string;
    uploadKeyPrefix: string;
}

export interface MediaUpdateRequestBody {
    title: string;
    description?: string | null;
    tags: MediaTag[];
    thumbnailFocalPoint: Coordinates;
    collectionId?: string | null; // Optional field if media is part of a collection in the future
}

const mediaUpdateBodySchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    description: z.string().nullish(),
    tags: z.array(z.enum(MEDIA_TAGS)).default([]),
    thumbnailFocalPoint: z.object({
        x: z.coerce.number(),
        y: z.coerce.number()
    }).default({ x: 0.5, y: 0.5 }),
    collectionId: z.string().nullish()
}) satisfies z.ZodType<MediaUpdateRequestBody>;

export interface MediaUpdateRequest {
    thumbnail?: UploadedFile;
    body: MediaUpdateRequestBody;
}

const mediaUpdateRawSchema = z.object({
    files: z.object({
        thumbnail: z.array(uploadedFileZodSchema('image/', 'Only image files are allowed')).max(1),
    }),
    body: mediaUpdateBodySchema
});

export interface ValidatedMediaUploadRequest extends MediaUpdateRequest {
    file: UploadedFile;
    thumbnail: UploadedFile;
}

export const mediaUploadRequestSchema: z.ZodType<ValidatedMediaUploadRequest> = z.object({
    files: z.object({
        file: z.array(uploadedFileZodSchema('video/', 'Only video files are allowed')).length(1),
        thumbnail: z.array(uploadedFileZodSchema('image/', 'Only image files are allowed')).length(1),
    }),
    body: mediaUpdateBodySchema,
}).transform(({ files, body }) => ({
    body: body,
    file: files.file[0],
    thumbnail: files.thumbnail[0],
}));

interface mediaUpdateRequestWithId extends RequestWithIdParam, MediaUpdateRequest { }

const mediaUpdateRequestWithIdSchema: z.ZodType<mediaUpdateRequestWithId> =
    requestWithIdParamZodSchema.extend(mediaUpdateRawSchema.shape).transform(({ params, files, body }) => ({ params, body, thumbnail: files.thumbnail[0] }));


export const validateMediaUpdateRequest = validateRequest(mediaUpdateRequestWithIdSchema);

export const validateMediaUploadRequest = validateRequest(mediaUploadRequestSchema);