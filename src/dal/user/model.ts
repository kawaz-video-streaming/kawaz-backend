import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";
import { Role, roles, USER_ROLE } from "../../utils/types";

export interface User {
  name: string;
  password: string;
  role: Role;
}

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: roles, default: USER_ROLE },
  },
  { versionKey: false },
);

export const createUserModel = (client: MongoClient) => client.createModel("user", userSchema);

export type UserModel = Model<User>;
