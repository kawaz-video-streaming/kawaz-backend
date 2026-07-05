import { isNil, isNotNil } from "ramda";
import z from "zod";
import { ContentRequestMediaType, ContentRequestUpdatableStatus, contentRequestMediaTypes, contentRequestUpdatableStatuses } from "../../dal/contentRequest/model";
import { requestWithIdParamZodSchema } from "../../utils/types";
import { validateRequest } from "../../utils/zod";

const refineContentRequestMediaType = (val: { mediaType: ContentRequestMediaType; seasonNumber?: number }, ctx: z.RefinementCtx) => {
    if (val.mediaType === "season" && isNil(val.seasonNumber))
        ctx.addIssue({ code: "custom", message: "seasonNumber is required for season requests" });
    if (val.mediaType !== "season" && isNotNil(val.seasonNumber))
        ctx.addIssue({ code: "custom", message: "seasonNumber is only valid for season requests" });
};

interface CreateContentRequestBody {
    tmdbId: number;
    mediaType: ContentRequestMediaType;
    title: string;
    year?: number;
    seasonNumber?: number;
    posterPath?: string | null;
}

const createContentRequestBodyZodSchema = z.object({
    tmdbId: z.number(),
    mediaType: z.enum(contentRequestMediaTypes),
    title: z.string().min(1),
    year: z.number().optional(),
    seasonNumber: z.number().optional(),
    posterPath: z.string().nullish(),
}).superRefine(refineContentRequestMediaType) satisfies z.ZodType<CreateContentRequestBody>;

const createContentRequestRequestZodSchema = z.object({
    body: createContentRequestBodyZodSchema,
}).transform(({ body }) => body);

export const validateCreateContentRequestRequest = validateRequest(createContentRequestRequestZodSchema);

interface UpdateContentRequestStatusBody {
    status: ContentRequestUpdatableStatus;
    note?: string;
}

const updateContentRequestStatusBodyZodSchema = z.object({
    status: z.enum(contentRequestUpdatableStatuses),
    note: z.string().optional(),
}) satisfies z.ZodType<UpdateContentRequestStatusBody>;

const updateContentRequestStatusRequestZodSchema = z.object({
    params: requestWithIdParamZodSchema.shape.params,
    body: updateContentRequestStatusBodyZodSchema,
}).transform(({ params, body }) => ({ id: params.id, ...body }));

export const validateUpdateContentRequestStatusRequest = validateRequest(updateContentRequestStatusRequestZodSchema);

interface TmdbTitleYearQuery {
    title: string;
    year: number;
}

const tmdbTitleYearQueryZodSchema = z.object({
    title: z.string().min(1),
    year: z.coerce.number().int().positive(),
}) satisfies z.ZodType<TmdbTitleYearQuery>;

const tmdbTitleYearRequestZodSchema = z.object({
    query: tmdbTitleYearQueryZodSchema,
}).transform(({ query }) => query);

export const validateTmdbMovieRequest = validateRequest(tmdbTitleYearRequestZodSchema);
export const validateTmdbShowRequest = validateRequest(tmdbTitleYearRequestZodSchema);

interface TmdbSeasonQuery {
    showTitle: string;
    showYear: number;
    seasonNumber: number;
}

const tmdbSeasonQueryZodSchema = z.object({
    showTitle: z.string().min(1),
    showYear: z.coerce.number().int().positive(),
    seasonNumber: z.coerce.number().int().positive(),
}) satisfies z.ZodType<TmdbSeasonQuery>;

const tmdbSeasonRequestZodSchema = z.object({
    query: tmdbSeasonQueryZodSchema,
}).transform(({ query }) => query);

export const validateTmdbSeasonRequest = validateRequest(tmdbSeasonRequestZodSchema);
