import { Types } from "@ido_kawaz/mongo-client";
import z from "zod";
import { validateRequest } from "../../utils/zod";

interface MediaGenreIdRequest {
    genreId: string;
}

const mediaGenreIdRequestBodyZodSchema = z.object({
    genreId: z.string().refine((v) => Types.ObjectId.isValid(v), {
        message: "Invalid genre ID",
    }),
}) satisfies z.ZodType<MediaGenreIdRequest>;

const mediaGenreIdRequestZodSchema = z.object({
    params: mediaGenreIdRequestBodyZodSchema
}).transform(({ params }) => params);

export const validateMediaGenreIdRequest = validateRequest(mediaGenreIdRequestZodSchema);

interface MediaGenreNamedRequest {
    name: string;
}

const mediaGenreNamedRequestBodyZodSchema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
}) satisfies z.ZodType<MediaGenreNamedRequest>;

const mediaGenreNamedRequestZodSchema = z.object({
    body: mediaGenreNamedRequestBodyZodSchema
}).transform(({ body }) => body);

export const validateMediaGenreNamedRequest = validateRequest(mediaGenreNamedRequestZodSchema);