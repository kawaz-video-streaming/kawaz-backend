import { BadRequestError, Request, RequestFile } from "@ido_kawaz/server-framework";
import z from "zod";
import { MEDIA_TAGS, MediaTag } from "../../dal/media/model";
import { Types } from "@ido_kawaz/mongo-client";

export interface MediaConfig {
    vodStorageBucket: string;
    uploadStorageBucket: string;
    uploadKeyPrefix: string;
}

export interface MediaUpdateRequestBody {
    title: string;
    description?: string;
    tags: MediaTag[];
}

export interface MediaUpdateRequest {
    body: MediaUpdateRequestBody;
}

const mediaUpdateBodySchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    description: z.string().optional(),
    tags: z.array(z.enum(MEDIA_TAGS)).default([])
});

const mediaUpdateRequestSchema = z.object({
    body: mediaUpdateBodySchema
}) satisfies z.ZodType<MediaUpdateRequest>;

interface RequestWithIdParam {
    params: {
        id: string;
    };
}

const requestWithIdParamSchema = z.object({
    params: z.object({
        id: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid media ID' })
    })
}) satisfies z.ZodType<RequestWithIdParam>;

export type UploadedFile = Pick<RequestFile, 'path' | 'originalname' | 'mimetype' | 'size'>;

export interface ValidatedMediaUploadRequest extends MediaUpdateRequest {
    file: UploadedFile;
    thumbnail?: UploadedFile;
}

const uploadedFileSchema = (mimePrefix: string, errorMessage: string) => z.object({
    path: z.string(),
    originalname: z.string(),
    mimetype: z.string().refine(
        mime => mime.startsWith(mimePrefix),
        { message: errorMessage }
    ),
    size: z.number()
});

export const mediaUploadRequestSchema = z.object({
    files: z.object({
        file: z.array(uploadedFileSchema('video/', 'Only video files are allowed')).length(1),
        thumbnail: z.array(uploadedFileSchema('image/', 'Only image files are allowed')).length(1).optional(),
    }),
    body: mediaUpdateBodySchema,
}).transform(({ files, body }) => ({
    body,
    file: files.file[0],
    thumbnail: files.thumbnail?.[0],
})) satisfies z.ZodType<ValidatedMediaUploadRequest>;

interface mediaUpdateRequestWithId extends RequestWithIdParam, MediaUpdateRequest { }

const mediaUpdateRequestWithIdSchema =
    requestWithIdParamSchema.extend(mediaUpdateRequestSchema.shape) satisfies z.ZodType<mediaUpdateRequestWithId>;

export const validateMediaRequestWithId = (req: Request): RequestWithIdParam => {
    const validationResult = requestWithIdParamSchema.safeParse(req);
    if (!validationResult.success) {
        throw new BadRequestError(`Invalid request: \n${validationResult.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return validationResult.data;
}

export const validateMediaUpdateRequest = (req: Request): mediaUpdateRequestWithId => {
    const validationResult = mediaUpdateRequestWithIdSchema.safeParse(req);
    if (!validationResult.success) {
        throw new BadRequestError(`Invalid request: \n${validationResult.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return validationResult.data;
}

export const validateMediaUploadRequest = (req: Request): ValidatedMediaUploadRequest => {
    const validationResult = mediaUploadRequestSchema.safeParse(req);
    if (!validationResult.success) {
        throw new BadRequestError(`Invalid request: \n${validationResult.error.issues.map(detail => detail.message).join(',\n')}`);
    }
    return validationResult.data;
}