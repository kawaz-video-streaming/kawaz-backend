import { Model, MongoClient, Schema } from "@ido_kawaz/mongo-client";

export interface User {
  name: string;
  password: string;
}

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true },
    password: { type: String, required: true },
  },
  { versionKey: false },
);

export const createUserModel = (client: MongoClient) => client.createModel("user", userSchema);

export type UserModel = Model<User>;
