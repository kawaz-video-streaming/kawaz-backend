import { Dal } from "@ido_kawaz/mongo-client";
import { isNil, isNotNil } from "ramda";
import { ADMIN_ROLE } from "../../utils/types";
import { APPROVED_STATUS, DENIED_STATUS, PENDING_STATUS, Profile, User, UserModel, UserProjection } from "./model";

export class UserDal extends Dal<User> {
  constructor(userModel: UserModel) {
    super(userModel);
  }

  createUser = (name: string, password: string, email: string): Promise<User> =>
    this.model.create({ name, password, email });

  removeUser = (name: string) =>
    this.model.findOneAndDelete({ name }).exec();

  findUser = (name: string): Promise<User | null> =>
    this.model.findOne({ name }).lean<User>().exec();

  verifyUser = async (name: string): Promise<boolean> =>
    isNotNil(await this.model.exists({ name }));

  approveUser = (name: string) =>
    this.model
      .findOneAndUpdate({ name, status: PENDING_STATUS }, { status: APPROVED_STATUS })
      .lean<User>()
      .exec();

  denyUser = (name: string) =>
    this.model
      .findOneAndUpdate({ name, status: PENDING_STATUS }, { status: DENIED_STATUS })
      .lean<User>()
      .exec();

  promoteToAdmin = async (name: string): Promise<boolean> =>
    isNotNil(await this.model.findOneAndUpdate({ name }, { role: ADMIN_ROLE }));

  getPendingUsers = (): Promise<UserProjection[]> =>
    this.model.find({ status: PENDING_STATUS }, { name: 1, email: 1 }).lean<UserProjection[]>().exec();

  createProfile = async (
    name: string,
    newProfile: Profile,
  ): Promise<boolean> => {
    const user = await this.findUser(name);
    if (isNil(user)) {
      return true;
    } else if (user.profiles.some((p) => p.name === newProfile.name)) {
      return false;
    }
    await this.model
      .findOneAndUpdate({ name }, { $push: { profiles: newProfile } })
      .exec();
    return true;
  };

  updateProfileAvatar = async (
    username: string,
    profileName: string,
    avatarId: string,
  ): Promise<boolean> => {
    const user = await this.findUser(username);
    if (isNil(user)) {
      return false;
    }
    const profileIndex = user.profiles.findIndex((p) => p.name === profileName);
    if (profileIndex === -1) {
      return false;
    }
    user.profiles[profileIndex].avatarId = avatarId;
    await this.model
      .findOneAndUpdate({ name: username }, { profiles: user.profiles })
      .exec();
    return true;
  };

  deleteProfile = async (name: string, profileName: string): Promise<void> => {
    await this.model
      .findOneAndUpdate(
        { name },
        { $pull: { profiles: { name: profileName } } },
      )
      .exec();
  };

  getUserProfiles = async (name: string): Promise<Profile[] | null> => {
    const user = await this.findUser(name);
    return isNil(user) ? null : user.profiles;
  };
}
