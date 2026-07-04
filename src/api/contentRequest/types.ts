import z from "zod";
import { contentRequestMediaTypes, contentRequestTerminalStatuses } from "../../dal/contentRequest/model";
import { requestWithIdParamZodSchema } from "../../utils/types";
import { validateRequest } from "../../utils/zod";

interface CreateContentRequestBody {
    tmdbId: number;
    mediaType: typeof contentRequestMediaTypes[number];
    title: string;
    year?: number;
    posterPath?: string | null;
}

const createContentRequestBodyZodSchema = z.object({
    tmdbId: z.number(),
    mediaType: z.enum(contentRequestMediaTypes),
    title: z.string().min(1),
    year: z.number().optional(),
    posterPath: z.string().nullish(),
}) satisfies z.ZodType<CreateContentRequestBody>;

const createContentRequestRequestZodSchema = z.object({
    body: createContentRequestBodyZodSchema,
}).transform(({ body }) => body);

export const validateCreateContentRequestRequest = validateRequest(createContentRequestRequestZodSchema);

interface UpdateContentRequestStatusBody {
    status: typeof contentRequestTerminalStatuses[number] | "acknowledged";
    note?: string;
}

const updateContentRequestStatusBodyZodSchema = z.object({
    status: z.enum(["acknowledged", ...contentRequestTerminalStatuses]),
    note: z.string().optional(),
}) satisfies z.ZodType<UpdateContentRequestStatusBody>;

const updateContentRequestStatusRequestZodSchema = z.object({
    params: requestWithIdParamZodSchema.shape.params,
    body: updateContentRequestStatusBodyZodSchema,
}).transform(({ params, body }) => ({ id: params.id, ...body }));

export const validateUpdateContentRequestStatusRequest = validateRequest(updateContentRequestStatusRequestZodSchema);

interface TmdbSearchQuery {
    title: string;
}

const tmdbSearchQueryZodSchema = z.object({
    title: z.string().min(1),
}) satisfies z.ZodType<TmdbSearchQuery>;

const tmdbSearchRequestZodSchema = z.object({
    query: tmdbSearchQueryZodSchema,
}).transform(({ query }) => query);

export const validateTmdbSearchRequest = validateRequest(tmdbSearchRequestZodSchema);
