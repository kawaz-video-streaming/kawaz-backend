import { isNil, isNotNil } from "ramda";
import z from "zod";
import { Coordinates, MediaKind, mediaKinds, RequestWithIdParam, requestWithIdParamZodSchema, UploadedFile, uploadedFileZodSchema } from "../../utils/types";
import { validateRequest } from "../../utils/zod";

const refineMediaKind = (val: { kind: MediaKind; episodeNumber?: number | null }, ctx: z.RefinementCtx) => {
    if (val.kind === "episode" && isNil(val.episodeNumber))
        ctx.addIssue({ code: "custom", message: "episodeNumber is required for episodes" });
    if (val.kind === "movie" && isNotNil(val.episodeNumber))
        ctx.addIssue({ code: "custom", message: "episodeNumber is not valid for movies" });
};

export interface ConvertMessage {
    mediaId: string;
    mediaFileName: string;
    mediaStorageBucket: string;
    mediaRoutingKey: string;
}

export interface MediaUpdateRequestBody {
    title: string;
    description?: string | null;
    kind: MediaKind;
    episodeNumber?: number | null;
    genres: string[];
    thumbnailFocalPoint: Coordinates;
    collectionId?: string | null;
}

const mediaUpdateBodySchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    description: z.string().nullish(),
    kind: z.enum(mediaKinds),
    episodeNumber: z.coerce.number().nullish(),
    genres: z.array(z.string()).default([]),
    thumbnailFocalPoint: z.object({
        x: z.coerce.number(),
        y: z.coerce.number()
    }).default({ x: 0.5, y: 0.5 }),
    collectionId: z.string().nullish()
}).superRefine(refineMediaKind) satisfies z.ZodType<MediaUpdateRequestBody>;

export interface MediaUpdateRequest {
    thumbnail?: UploadedFile;
    body: MediaUpdateRequestBody;
}

const mediaUpdateRawSchema = z.object({
    files: z.object({
        thumbnail: z.array(uploadedFileZodSchema('image/', 'Only image files are allowed')).max(1).default([]),
    }).default({ thumbnail: [] }),
    body: mediaUpdateBodySchema
});

// --- presigned upload ---

export interface InitiateUploadRequestBody extends MediaUpdateRequestBody {
    fileName: string;
    fileSize: number;
    mimeType: string;
}

const initiateUploadBodySchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    description: z.string().nullish(),
    kind: z.enum(mediaKinds),
    episodeNumber: z.coerce.number().nullish(),
    genres: z.array(z.string()).default([]),
    thumbnailFocalPoint: z.object({
        x: z.coerce.number(),
        y: z.coerce.number()
    }).default({ x: 0.5, y: 0.5 }),
    collectionId: z.string().nullish(),
    fileName: z.string().min(1),
    fileSize: z.number().positive(),
    mimeType: z.string().refine((m) => m.startsWith('video/'), { message: 'Only video files are allowed' }),
}).superRefine(refineMediaKind) satisfies z.ZodType<InitiateUploadRequestBody>;

export interface InitiateUploadResponse {
    mediaId: string;
    videoUploadUrl: string;
    thumbnailUploadUrl: string;
}

export const validateInitiateUploadRequest = validateRequest(
    z.object({ body: initiateUploadBodySchema }).transform(({ body }) => body)
);

export const validateCompleteUploadRequest = validateRequest(
    z.object({ body: z.object({ mediaId: z.string().min(1) }) })
);

// --- update (PUT /:id) ---

interface mediaUpdateRequestWithId extends RequestWithIdParam, MediaUpdateRequest { }

const mediaUpdateRequestWithIdSchema: z.ZodType<mediaUpdateRequestWithId> =
    requestWithIdParamZodSchema.extend(mediaUpdateRawSchema.shape).transform(({ params, files, body }) => ({ params, body, thumbnail: files.thumbnail[0] }));

export const validateMediaUpdateRequest = validateRequest(mediaUpdateRequestWithIdSchema);

// --- TMDB details query ---

export interface TmdbMovieDetailsQuery {
    title: string;
    year: number;
}

export const validateGetMovieTmdbDetailsRequest = validateRequest(
    z.object({ query: z.object({ title: z.string().min(1), year: z.coerce.number().int().positive() }) })
     .transform(({ query }) => query as TmdbMovieDetailsQuery)
);
