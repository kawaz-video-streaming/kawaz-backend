import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";
import z from "zod";
import { Role, roles, USER_ROLE } from "../../utils/types";
import { validateSchemaAndReturnValue } from "../../utils/zod";

export const PENDING_STATUS = "pending";
export const APPROVED_STATUS = "approved";
export const DENIED_STATUS = "denied";

export const statuses = [
  PENDING_STATUS,
  APPROVED_STATUS,
  DENIED_STATUS,
] as const;

export type Status = (typeof statuses)[number];

export interface Profile {
  name: string;
  avatarId: string;
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
}

export type UserProjection = Pick<User, "name" | "email">;

const userProjectionZodSchema: z.ZodType<UserProjection> = z.object({
  name: z.string(),
  email: z.email(),
});

export const validateUserProjection = validateSchemaAndReturnValue(userProjectionZodSchema);

const profileSchema = new Schema<Profile>({
  name: { type: String, required: true },
  avatarId: { type: String, required: true },
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
  },
  { versionKey: false },
);

export const createUserModel = (client: MongoClient) =>
  client.createModel("user", userSchema);

export type UserModel = Model<User>;
