import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";
import { Role, roles, USER_ROLE } from "../../utils/types";

export interface Profile {
  name: string;
  avatarId: string;
}

export interface User {
  name: string;
  password: string;
  role: Role;
  profiles: Profile[];
}

const profileSchema = new Schema<Profile>({
  name: { type: String, required: true },
  avatarId: { type: String, required: true },
});

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: roles, default: USER_ROLE },
    profiles: { type: [profileSchema], default: [] },
  },
  { versionKey: false },
);

export const createUserModel = (client: MongoClient) => client.createModel("user", userSchema);

export type UserModel = Model<User>;
