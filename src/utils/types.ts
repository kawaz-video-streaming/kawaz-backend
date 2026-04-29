import { Schema, Types } from "@ido_kawaz/mongo-client";
import { Request, RequestFile } from "@ido_kawaz/server-framework";
import z from "zod";

export const ADMIN_ROLE = "admin";
export const USER_ROLE = "user";

export const roles = [ADMIN_ROLE, USER_ROLE] as const;

export type Role = (typeof roles)[number];

export interface AuthenticatedRequest extends Request {
  user: {
    username: string;
    role: Role;
  };
}

export const MEDIA_TAGS = [
  "Action",
  "Fantasy",
  "Adventure",
  "Superhero",
  "Anime",
  "Animation",
  "Comedy",
  "Parody",
  "Crime",
  "Documentary",
  "Drama",
  "Education",
  "Horror",
  "Kids",
  "Music",
  "News",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
] as const;

export type MediaTag = (typeof MEDIA_TAGS)[number];

export const AVATAR_CATEGORIES = [
  "United Kingdom",
  "United States",
  "Israel",
  "Japan",
  "France",
] as const;

export type AvatarCategory = (typeof AVATAR_CATEGORIES)[number];

export const mediaKinds = ["movie", "episode"] as const;

export type MediaKind = typeof mediaKinds[number];

export const mediaCollectionKinds = ['show', 'season', 'collection'] as const;

export type MediaCollectionKind = typeof mediaCollectionKinds[number];

export interface Coordinates {
  x: number;
  y: number;
}

export const coordinatesSchema = new Schema<Coordinates>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

export interface UploadedFile extends Pick<
  RequestFile,
  "path" | "mimetype" | "size"
> {
  fileName: string;
}

export const uploadedFileZodSchema = (
  mimePrefix: string,
  errorMessage: string,
) =>
  z
    .object({
      path: z.string(),
      originalname: z.string(),
      mimetype: z.string().refine((mime) => mime.startsWith(mimePrefix), {
        message: errorMessage,
      }),
      size: z.number(),
    })
    .transform(({ originalname, ...rest }) => ({
      fileName: originalname,
      ...rest,
    })) satisfies z.ZodType<UploadedFile>;

export interface RequestWithIdParam {
  params: {
    id: string;
  };
}

export const requestWithIdParamZodSchema = z.object({
  params: z.object({
    id: z.string().refine((v) => Types.ObjectId.isValid(v), {
      message: "Invalid media ID",
    }),
  }),
}) satisfies z.ZodType<RequestWithIdParam>;

export interface BucketsConfig {
  kawazPlus: {
    kawazStorageBucket: string;
    uploadPrefix: string;
    thumbnailPrefix: string;
    avatarPrefix: string;
  };
  vod: {
    vodStorageBucket: string;
  };
}