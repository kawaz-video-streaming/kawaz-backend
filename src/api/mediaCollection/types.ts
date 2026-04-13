import z from "zod";
import { Coordinates, MEDIA_TAGS, MediaTag, RequestWithIdParam, requestWithIdParamZodSchema, UploadedFile, uploadedFileZodSchema } from "../../utils/types";
import { validateRequest } from "../../utils/zod";
import { Types } from "@ido_kawaz/mongo-client";

export interface MediaCollectionUpdateRequestBody {
    title: string;
    description?: string | null;
    tags: MediaTag[];
    thumbnailFocalPoint: Coordinates;
    collectionId?: string | null; // Optional field if the collection is nested within another collection in the future
}

const mediaCollectionUpdateBodySchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    description: z.string().nullish(),
    tags: z.array(z.enum(MEDIA_TAGS)).default([]),
    thumbnailFocalPoint: z.object({
        x: z.coerce.number(),
        y: z.coerce.number()
    }).default({ x: 0.5, y: 0.5 }),
    collectionId: z.string().refine((id) => Types.ObjectId.isValid(id), { message: "Invalid ObjectId" }).nullish()
}) satisfies z.ZodType<MediaCollectionUpdateRequestBody>;

export interface MediaCollectionUpdateRequest {
    thumbnail?: UploadedFile;
    body: MediaCollectionUpdateRequestBody;
}

const mediaCollectionUpdateRawSchema = z.object({
    files: z.object({
        thumbnail: z.array(uploadedFileZodSchema('image/', 'Only image files are allowed')).max(1).default([]),
    }).default({ thumbnail: [] }),
    body: mediaCollectionUpdateBodySchema
});


export interface ValidatedMediaCollectionCreationRequest extends Required<MediaCollectionUpdateRequest> { }

export const mediaCollectionCreationRequestSchema: z.ZodType<ValidatedMediaCollectionCreationRequest> = z.object({
    file: uploadedFileZodSchema('image/', 'Only image files are allowed'),
    body: mediaCollectionUpdateBodySchema,
}).transform(({ file, body }) => ({ thumbnail: file, body }));

interface mediaCollectionUpdateRequestWithId extends RequestWithIdParam, MediaCollectionUpdateRequest { }

const mediaCollectionUpdateRequestWithIdSchema: z.ZodType<mediaCollectionUpdateRequestWithId> = requestWithIdParamZodSchema
    .extend(mediaCollectionUpdateRawSchema.shape)
    .transform(({ params, files, body }) => ({ params, body, thumbnail: files.thumbnail[0] }));

export const validateMediaCollectionUpdateRequest = validateRequest(mediaCollectionUpdateRequestWithIdSchema);

export const validateMediaCollectionCreationRequest = validateRequest(mediaCollectionCreationRequestSchema);