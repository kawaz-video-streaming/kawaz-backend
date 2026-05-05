import z from "zod";
import { validateSchemaAndReturnValue } from "../../utils/zod";

export interface TmdbGenre {
    id: number;
    name: string;
}

export interface TmdbCollection {
    id: number;
    name: string;
    poster_url: string | null;
    backdrop_url: string | null;
}

export interface TmdbMovieDetails {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    poster_url: string | null;
    backdrop_url: string | null;
    genres: TmdbGenre[];
    vote_average: number;
    vote_count: number;
    runtime: number | null;
    tagline: string;
    imdb_id: string | null;
    belongs_to_collection: TmdbCollection | null;
}

export interface TmdbSearchMovieResult {
    id: number;
    title: string;
    original_title: string;
    overview: string;
    release_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    genre_ids: number[];
    popularity: number;
    vote_average: number;
    vote_count: number;
    adult: boolean;
    softcore: boolean;
    video: boolean;
    original_language: string;
}

export interface TmdbSearchMovieResponse {
    page: number;
    results: TmdbSearchMovieResult[];
    total_pages: number;
    total_results: number;
}

interface TmdbCollectionRaw {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
}

export interface TmdbMovieDetailsRaw {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    genres: TmdbGenre[];
    vote_average: number;
    vote_count: number;
    runtime: number | null;
    tagline: string;
    imdb_id: string | null;
    belongs_to_collection: TmdbCollectionRaw | null;
}

const TmdbGenreZodSchema: z.ZodType<TmdbGenre> = z.object({
    id: z.number(),
    name: z.string(),
});

const TmdbCollectionRawZodSchema: z.ZodType<TmdbCollectionRaw> = z.object({
    id: z.number(),
    name: z.string(),
    poster_path: z.string().nullable(),
    backdrop_path: z.string().nullable(),
});

const TmdbMovieZodSchema: z.ZodType<TmdbSearchMovieResult> = z.object({
    id: z.number(),
    title: z.string(),
    original_title: z.string(),
    overview: z.string(),
    release_date: z.string(),
    poster_path: z.string().nullable(),
    backdrop_path: z.string().nullable(),
    genre_ids: z.array(z.number()),
    popularity: z.number(),
    vote_average: z.number(),
    vote_count: z.number(),
    adult: z.boolean(),
    softcore: z.boolean(),
    video: z.boolean(),
    original_language: z.string()
});

const TmdbSearchMovieResponseZodSchema: z.ZodType<TmdbSearchMovieResponse> = z.object({
    page: z.number(),
    results: z.array(TmdbMovieZodSchema),
    total_pages: z.number(),
    total_results: z.number(),
});

const TmdbMovieDetailsRawZodSchema: z.ZodType<TmdbMovieDetailsRaw> = z.object({
    id: z.number(),
    title: z.string(),
    overview: z.string(),
    release_date: z.string(),
    poster_path: z.string().nullable(),
    backdrop_path: z.string().nullable(),
    genres: z.array(TmdbGenreZodSchema),
    vote_average: z.number(),
    vote_count: z.number(),
    runtime: z.number().nullable(),
    tagline: z.string(),
    imdb_id: z.string().nullable(),
    belongs_to_collection: TmdbCollectionRawZodSchema.nullable()
});

export const validateTmdbSearchMovieResponse = validateSchemaAndReturnValue(TmdbSearchMovieResponseZodSchema);
export const validateTmdbMovieDetailsRaw = validateSchemaAndReturnValue(TmdbMovieDetailsRawZodSchema);

export interface TmdbSearchShowResult {
    id: number;
    name: string;
    original_name: string;
    overview: string;
    first_air_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    genre_ids: number[];
    popularity: number;
    vote_average: number;
    vote_count: number;
    adult: boolean;
    softcore: boolean;
    origin_country: string[];
    original_language: string;
}

export interface TmdbSearchShowResponse {
    page: number;
    results: TmdbSearchShowResult[];
    total_pages: number;
    total_results: number;
}

export interface TmdbShowDetailsRaw {
    id: number;
    name: string;
    overview: string;
    first_air_date: string;
    poster_path: string | null;
    backdrop_path: string | null;
    genres: TmdbGenre[];
    vote_average: number;
    vote_count: number;
    number_of_seasons: number;
    tagline: string;
}

export interface TmdbShowDetails {
    id: number;
    name: string;
    overview: string;
    first_air_date: string;
    poster_url: string | null;
    backdrop_url: string | null;
    genres: TmdbGenre[];
    vote_average: number;
    vote_count: number;
    number_of_seasons: number;
    tagline: string;
}

const TmdbShowZodSchema: z.ZodType<TmdbSearchShowResult> = z.object({
    id: z.number(),
    name: z.string(),
    original_name: z.string(),
    overview: z.string(),
    first_air_date: z.string(),
    poster_path: z.string().nullable(),
    backdrop_path: z.string().nullable(),
    genre_ids: z.array(z.number()),
    popularity: z.number(),
    vote_average: z.number(),
    vote_count: z.number(),
    adult: z.boolean(),
    softcore: z.boolean(),
    origin_country: z.array(z.string()),
    original_language: z.string(),
});

const TmdbSearchShowResponseZodSchema: z.ZodType<TmdbSearchShowResponse> = z.object({
    page: z.number(),
    results: z.array(TmdbShowZodSchema),
    total_pages: z.number(),
    total_results: z.number(),
});

const TmdbShowDetailsRawZodSchema: z.ZodType<TmdbShowDetailsRaw> = z.object({
    id: z.number(),
    name: z.string(),
    overview: z.string(),
    first_air_date: z.string(),
    poster_path: z.string().nullable(),
    backdrop_path: z.string().nullable(),
    genres: z.array(TmdbGenreZodSchema),
    vote_average: z.number(),
    vote_count: z.number(),
    number_of_seasons: z.number(),
    tagline: z.string(),
});

export const validateTmdbSearchShowResponse = validateSchemaAndReturnValue(TmdbSearchShowResponseZodSchema);
export const validateTmdbShowDetailsRaw = validateSchemaAndReturnValue(TmdbShowDetailsRawZodSchema);

// --- Collection details ---

interface TmdbCollectionPart {
    id: number;
    genre_ids: number[];
}

export interface TmdbCollectionDetailsRaw {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    parts: TmdbCollectionPart[];
}

export interface TmdbCollectionDetails {
    id: number;
    name: string;
    overview: string;
    poster_url: string | null;
    backdrop_url: string | null;
    genres: TmdbGenre[];
}

interface TmdbGenreListRaw {
    genres: TmdbGenre[];
}

const TmdbCollectionPartZodSchema: z.ZodType<TmdbCollectionPart> = z.object({
    id: z.number(),
    genre_ids: z.array(z.number()),
});

const TmdbCollectionDetailsRawZodSchema: z.ZodType<TmdbCollectionDetailsRaw> = z.object({
    id: z.number(),
    name: z.string(),
    overview: z.string(),
    poster_path: z.string().nullable(),
    backdrop_path: z.string().nullable(),
    parts: z.array(TmdbCollectionPartZodSchema),
});

const TmdbGenreListRawZodSchema: z.ZodType<TmdbGenreListRaw> = z.object({
    genres: z.array(TmdbGenreZodSchema),
});

export const validateTmdbCollectionDetailsRaw = validateSchemaAndReturnValue(TmdbCollectionDetailsRawZodSchema);
export const validateTmdbGenreList = validateSchemaAndReturnValue(TmdbGenreListRawZodSchema);

export interface TmdbEpisodeDetailsRaw {
    id: number;
    name: string;
    overview: string;
    air_date: string;
    episode_number: number;
    season_number: number;
    still_path: string | null;
    vote_average: number;
    vote_count: number;
    runtime: number | null;
}

export interface TmdbEpisodeDetails {
    id: number;
    name: string;
    overview: string;
    air_date: string;
    episode_number: number;
    season_number: number;
    still_url: string | null;
    vote_average: number;
    vote_count: number;
    runtime: number | null;
}

const TmdbEpisodeDetailsRawZodSchema: z.ZodType<TmdbEpisodeDetailsRaw> = z.object({
    id: z.number(),
    name: z.string(),
    overview: z.string(),
    air_date: z.string(),
    episode_number: z.number(),
    season_number: z.number(),
    still_path: z.string().nullable(),
    vote_average: z.number(),
    vote_count: z.number(),
    runtime: z.number().nullable(),
});

export const validateTmdbEpisodeDetailsRaw = validateSchemaAndReturnValue(TmdbEpisodeDetailsRawZodSchema);
