import { NotFoundError } from "@ido_kawaz/server-framework";
import { TmdbEpisodeDetails, TmdbEpisodeDetailsRaw, TmdbMovieDetails, TmdbMovieDetailsRaw, TmdbShowDetails, TmdbShowDetailsRaw, validateTmdbEpisodeDetailsRaw, validateTmdbMovieDetailsRaw, validateTmdbSearchMovieResponse, validateTmdbSearchShowResponse, validateTmdbShowDetailsRaw } from "./types";
import { isNil, isNotNil } from "ramda";

export interface TmdbConfig {
    readAccessToken: string;
}

export class TmdbClient {
    private baseUrl: string;
    private imageBaseUrl: string;
    private requestHeaders: {};

    constructor({ readAccessToken }: TmdbConfig) {
        this.baseUrl = "https://api.themoviedb.org/3";
        this.imageBaseUrl = "https://image.tmdb.org/t/p/original";
        this.requestHeaders = {
            Authorization: `Bearer ${readAccessToken}`,
            accept: "application/json"
        };
    }

    private toImageUrl = (path: string | null): string | null =>
        path ? `${this.imageBaseUrl}${path}` : null;

    private toEpisodeDetails = (raw: TmdbEpisodeDetailsRaw): TmdbEpisodeDetails => {
        const { still_path, ...rest } = raw;
        return { ...rest, still_url: this.toImageUrl(still_path) };
    }

    private toShowDetails = (raw: TmdbShowDetailsRaw): TmdbShowDetails => {
        const { poster_path, backdrop_path, ...rest } = raw;
        return {
            ...rest,
            poster_url: this.toImageUrl(poster_path),
            backdrop_url: this.toImageUrl(backdrop_path),
        };
    }

    private toMovieDetails = (raw: TmdbMovieDetailsRaw): TmdbMovieDetails => {
        const { poster_path, backdrop_path, belongs_to_collection, ...rest } = raw;
        return {
            ...rest,
            poster_url: this.toImageUrl(poster_path),
            backdrop_url: this.toImageUrl(backdrop_path),
            belongs_to_collection: belongs_to_collection ? {
                id: belongs_to_collection.id,
                name: belongs_to_collection.name,
                poster_url: this.toImageUrl(belongs_to_collection.poster_path),
                backdrop_url: this.toImageUrl(belongs_to_collection.backdrop_path),
            } : null
        };
    }

    private getRequest = async (endpoint: string, params?: URLSearchParams): Promise<any> => {
        const response = await fetch(`${this.baseUrl}${endpoint}${isNotNil(params) ? `?${params.toString()}` : ''}`, {
            method: "GET",
            headers: this.requestHeaders
        });
        return response.json();
    }

    getMovieDetails = async (title: string, year: number): Promise<TmdbMovieDetails> => {
        const searchParams = new URLSearchParams({
            query: title,
            year: year.toString(),
            language: "en-US"
        });
        const searchJson = await this.getRequest("/search/movie", searchParams);
        const searchResults = validateTmdbSearchMovieResponse(searchJson);
        const topResult = searchResults.results.find(movie => movie.vote_count > 10);
        if (isNil(topResult)) {
            throw new NotFoundError(`No movie found on TMDB for title "${title}" and year ${year}`);
        }
        const detailsJson = await this.getRequest(`/movie/${topResult.id}`);
        const rawDetails = validateTmdbMovieDetailsRaw(detailsJson);
        return this.toMovieDetails(rawDetails);
    }

    getShowDetails = async (title: string, year: number): Promise<TmdbShowDetails> => {
        const searchParams = new URLSearchParams({
            query: title,
            first_air_date_year: year.toString(),
            language: "en-US"
        });
        const searchJson = await this.getRequest("/search/tv", searchParams);
        const searchResults = validateTmdbSearchShowResponse(searchJson);
        const topResult = searchResults.results.find(show => show.vote_count > 10);
        if (isNil(topResult)) {
            throw new NotFoundError(`No TV show found on TMDB for title "${title}" and year ${year}`);
        }
        const detailsJson = await this.getRequest(`/tv/${topResult.id}`);
        const rawDetails = validateTmdbShowDetailsRaw(detailsJson);
        return this.toShowDetails(rawDetails);
    }

    getEpisodeDetails = async (showTitle: string, showYear: number, seasonNumber: number, episodeNumber: number): Promise<TmdbEpisodeDetails> => {
        const searchParams = new URLSearchParams({
            query: showTitle,
            first_air_date_year: showYear.toString(),
            language: "en-US"
        });
        const searchJson = await this.getRequest("/search/tv", searchParams);
        const searchResults = validateTmdbSearchShowResponse(searchJson);
        const topResult = searchResults.results.find(show => show.vote_count > 10);
        if (isNil(topResult)) {
            throw new NotFoundError(`No TV show found on TMDB for title "${showTitle}" and year ${showYear}`);
        }
        const detailsJson = await this.getRequest(`/tv/${topResult.id}/season/${seasonNumber}/episode/${episodeNumber}`);
        const rawDetails = validateTmdbEpisodeDetailsRaw(detailsJson);
        return this.toEpisodeDetails(rawDetails);
    }
}
