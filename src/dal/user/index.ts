import { Dal } from "@ido_kawaz/mongo-client";
import { User, UserModel, } from "./model";
import { isNotNil } from "ramda";

export class UserDal extends Dal<User> {
  constructor(userModel: UserModel) {
    super(userModel);
  }

  createUser = (name: string, password: string): Promise<User> =>
    this.model.create({ name, password })

  findUser = (name: string): Promise<User | null> =>
    this.model.findOne({ name }).lean<User>().exec();

  verifyUser = async (name: string): Promise<boolean> =>
    isNotNil(await this.model.exists({ name }));
}
