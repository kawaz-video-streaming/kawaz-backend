import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";
import z from "zod";
import { Role, roles, USER_ROLE } from "../../utils/types";
import { validateSchemaAndReturnValue } from "../../utils/zod";

export const PENDING_STATUS = "pending" as const;
export const APPROVED_STATUS = "approved" as const;
export const DENIED_STATUS = "denied" as const;

export const statuses = [
  PENDING_STATUS,
  APPROVED_STATUS,
  DENIED_STATUS,
] as const;

export type Status = (typeof statuses)[number];

export interface WatchProgressEntry {
  mediaId: string;
  positionInMs: number;
  updatedAt: Date;
}

export const watchlistItemKinds = ["media", "collection"] as const;

export type WatchlistItemKind = (typeof watchlistItemKinds)[number];

export interface WatchlistEntry {
  id: string;
  kind: WatchlistItemKind;
}

export interface Profile {
  name: string;
  avatarId: string;
  watchProgress: WatchProgressEntry[];
  watchlist: WatchlistEntry[];
}

interface PasswordResetRequest {
  token: string;
  expiration: Date;
}

export interface User {
  name: string;
  password: string;
  email: string;
  status: Status;
  role: Role;
  profiles: Profile[];
  passwordResetRequest?: PasswordResetRequest;
  appleId?: string;
}

export type UserProjection = Pick<User, "name" | "email">;

const userProjectionZodSchema: z.ZodType<UserProjection> = z.object({
  name: z.string(),
  email: z.email(),
});

export const validateUserProjection = validateSchemaAndReturnValue(userProjectionZodSchema);

const watchProgressEntrySchema = new Schema<WatchProgressEntry>({
  mediaId: { type: String, required: true },
  positionInMs: { type: Number, required: true },
  updatedAt: { type: Date, required: true },
}, { _id: false });

const watchlistEntrySchema = new Schema<WatchlistEntry>({
  id: { type: String, required: true },
  kind: { type: String, enum: watchlistItemKinds, required: true },
}, { _id: false });

const profileSchema = new Schema<Profile>({
  name: { type: String, required: true },
  avatarId: { type: String, required: true },
  watchProgress: { type: [watchProgressEntrySchema], default: [] },
  watchlist: { type: [watchlistEntrySchema], default: [] },
});

const passwordResetRequestSchema = new Schema<PasswordResetRequest>({
  token: { type: String, required: true },
  expiration: { type: Date, required: true }
});

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    status: { type: String, enum: statuses, default: PENDING_STATUS },
    role: { type: String, enum: roles, default: USER_ROLE },
    profiles: { type: [profileSchema], default: [] },
    passwordResetRequest: { type: passwordResetRequestSchema, required: false },
    appleId: { type: String, required: false, sparse: true, unique: true },
  },
  { versionKey: false },
);

export const createUserModel = (client: MongoClient) =>
  client.createModel("user", userSchema);

export type UserModel = Model<User>;
