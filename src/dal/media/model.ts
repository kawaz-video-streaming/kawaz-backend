import { Model, MongoClient, Schema, Types } from "@ido_kawaz/mongo-client";
import z from "zod";

export const MEDIA_TAGS = [
  'Action',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Education',
  'Horror',
  'Kids',
  'Music',
  'News',
  'Romance',
  'Sci-Fi',
  'Sport',
  'Thriller',
] as const

export type MediaTag = (typeof MEDIA_TAGS)[number]

export const mediaResultStatuses = ["completed", "failed"] as const;

export type MediaResultStatus = typeof mediaResultStatuses[number];

export const mediaStatuses = ["pending", "processing", ...mediaResultStatuses] as const;

export type MediaStatus = typeof mediaStatuses[number];

export const PENDING: MediaStatus = 'pending';

export const COMPLETED: MediaStatus = 'completed';

interface Stream {
  title: string;
  durationInMs: number;
}

interface LanguageStream extends Stream {
  language: string;
}

export interface VideoStream extends Stream { }

export interface AudioStream extends LanguageStream { }

export interface SubtitleStream extends LanguageStream { }

export interface VideoChapter {
  chapterName: string;
  chapterStartTime: number;
  chapterEndTime: number;
}

export interface MediaMetadata {
  name: string;
  durationInMs: number;
  playUrl: string;
  chaptersUrl?: string;
  chapters?: VideoChapter[];
  videoStreams: VideoStream[];
  audioStreams: AudioStream[];
  subtitleStreams: SubtitleStream[];
}

const videoChapterZodSchema = z.object({
  chapterName: z.string(),
  chapterStartTime: z.coerce.number(),
  chapterEndTime: z.coerce.number()
}) satisfies z.ZodType<VideoChapter>;

const streamZodSchema = z.object({
  title: z.string(),
  durationInMs: z.coerce.number()
}) satisfies z.ZodType<Stream>;

const languageStreamZodSchema = streamZodSchema.extend({
  language: z.string()
}) satisfies z.ZodType<LanguageStream>;

const videoStreamZodSchema = streamZodSchema satisfies z.ZodType<VideoStream>;

const audioStreamZodSchema = languageStreamZodSchema satisfies z.ZodType<AudioStream>;

const subtitleStreamZodSchema = languageStreamZodSchema satisfies z.ZodType<SubtitleStream>;

export const mediaMetadataZodSchema = z.object({
  name: z.string(),
  durationInMs: z.coerce.number(),
  playUrl: z.string(),
  chaptersUrl: z.string().optional(),
  chapters: z.array(videoChapterZodSchema).optional(),
  videoStreams: z.array(videoStreamZodSchema),
  audioStreams: z.array(audioStreamZodSchema),
  subtitleStreams: z.array(subtitleStreamZodSchema)
}) satisfies z.ZodType<MediaMetadata>;

const videoChapterSchema = new Schema<VideoChapter>({
  chapterName: { type: String, required: true },
  chapterStartTime: { type: Number, required: true },
  chapterEndTime: { type: Number, required: true },
}, { _id: false });

const streamSchemaObject = {
  title: { type: String, required: true },
  durationInMs: { type: Number, required: true },
};

const languageStreamSchemaObject = {
  ...streamSchemaObject,
  language: { type: String, required: true },
};

const videoStreamSchema = new Schema<VideoStream>(streamSchemaObject, { _id: false });

const audioStreamSchema = new Schema<AudioStream>(languageStreamSchemaObject, { _id: false });

const subtitleStreamSchema = new Schema<SubtitleStream>(languageStreamSchemaObject, { _id: false });

const mediaMetadataSchema = new Schema<MediaMetadata>({
  name: { type: String, required: true },
  durationInMs: { type: Number, required: true },
  playUrl: { type: String, required: true },
  chaptersUrl: { type: String, required: false },
  chapters: { type: [videoChapterSchema], required: false },
  videoStreams: { type: [videoStreamSchema], required: true },
  audioStreams: { type: [audioStreamSchema], required: true },
  subtitleStreams: { type: [subtitleStreamSchema], required: true }
}, { _id: false });

export interface Media {
  _id: string;
  fileName: string;
  title: string;
  description?: string;
  tags: MediaTag[];
  size: number;
  status: MediaStatus;
  thumbnailUrl?: string;
  metadata?: MediaMetadata;
}

export const mediaZodSchema = z.object({
  _id: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid ObjectId' }),
  fileName: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.enum(MEDIA_TAGS)).default([]),
  size: z.coerce.number(),
  status: z.enum(mediaStatuses).default(PENDING),
  thumbnailUrl: z.string().optional(),
  metadata: mediaMetadataZodSchema.optional()
}) satisfies z.ZodType<Media>;

const mediaSchema = new Schema<Media>(
  {
    _id: { type: String, default: () => new Types.ObjectId().toString() },
    fileName: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: false },
    tags: { type: [String], enum: MEDIA_TAGS, default: [] },
    size: { type: Number, required: true },
    status: { type: String, enum: mediaStatuses, default: PENDING },
    metadata: { type: mediaMetadataSchema, required: false },
  },
  { versionKey: false },
);

export const createMediaModel = (client: MongoClient) => client.createModel("media", mediaSchema);

export type MediaModel = Model<Media>;
