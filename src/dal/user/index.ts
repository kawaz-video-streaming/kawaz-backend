import { Dal } from "@ido_kawaz/mongo-client";
import { isNil, isNotNil, propEq } from "ramda";
import { ADMIN_ROLE, Role } from "../../utils/types";
import { APPROVED_STATUS, DENIED_STATUS, PENDING_STATUS, Profile, User, UserModel, UserProjection, WatchlistItemKind, WatchProgressEntry } from "./model";

export class UserDal extends Dal<User> {
  constructor(userModel: UserModel) {
    super(userModel);
  }

  createUser = (name: string, password: string, email: string, appleId?: string): Promise<User> =>
    this.model.create({ name, password, email, ...(isNotNil(appleId) && { appleId }) });

  removeUser = (name: string) =>
    this.model.findOneAndDelete({ name }).exec();

  findUser = (name: string): Promise<User | null> =>
    this.model.findOne({ name }).lean<User>().exec();

  findUserByEmail = (email: string): Promise<User | null> =>
    this.model.findOne({ email }).lean<User>().exec();

  findUserByAppleId = (appleId: string): Promise<User | null> =>
    this.model.findOne({ appleId }).lean<User>().exec();

  linkAppleId = (name: string, appleId: string) =>
    this.model.findOneAndUpdate({ name }, { appleId }).exec();

  verifyUser = async (name: string): Promise<boolean> =>
    isNotNil(await this.model.exists({ name }));

  verifyEmail = async (email: string): Promise<boolean> =>
    isNotNil(await this.model.exists({ email }));

  approveUser = (name: string, role: Exclude<Role, "admin">): Promise<User | null> =>
    this.model.findOneAndUpdate({ name, status: PENDING_STATUS }, { status: APPROVED_STATUS, role }).lean<User>().exec();

  denyUser = (name: string): Promise<User | null> =>
    this.model.findOneAndUpdate({ name, status: PENDING_STATUS }, { status: DENIED_STATUS }).lean<User>().exec();

  promoteToAdmin = async (name: string): Promise<boolean> =>
    isNotNil(await this.model.findOneAndUpdate({ name }, { role: ADMIN_ROLE }).exec());

  getPendingUsers = (): Promise<UserProjection[]> =>
    this.model.find({ status: PENDING_STATUS }, { name: 1, email: 1 }).lean<UserProjection[]>().exec();

  getAllApprovedUserEmails = (): Promise<UserProjection[]> =>
    this.model.find({ status: APPROVED_STATUS }, { name: 1, email: 1 }).lean<UserProjection[]>().exec();

  createProfile = async (name: string, newProfile: Profile): Promise<boolean> => {
    const user = await this.findUser(name);
    if (isNil(user)) {
      return true;
    } else if (user.profiles.some((p) => p.name === newProfile.name)) {
      return false;
    }
    await this.model.findOneAndUpdate({ name }, { $push: { profiles: newProfile } }).exec();
    return true;
  };

  getProfile = async (username: string, profileName: string): Promise<Profile | null> => {
    const user = await this.findUser(username);
    if (isNil(user)) {
      return null;
    }
    return user.profiles.find(propEq(profileName, 'name')) ?? null;
  };

  updateProfileAvatar = async (username: string, profileName: string, avatarId: string): Promise<boolean> => {
    const user = await this.findUser(username);
    if (isNil(user)) {
      return false;
    }
    const profileIndex = user.profiles.findIndex(propEq(profileName, 'name'));
    if (profileIndex === -1) {
      return false;
    }
    user.profiles[profileIndex].avatarId = avatarId;
    await this.model.findOneAndUpdate({ name: username }, { profiles: user.profiles }).exec();
    return true;
  };

  upsertWatchProgress = async (username: string, profileName: string, mediaId: string, positionInMs: number): Promise<boolean> => {
    const user = await this.findUser(username);
    if (isNil(user)) {
      return false;
    }
    const profile = user.profiles.find(propEq(profileName, 'name'));
    if (isNil(profile)) {
      return false;
    }
    const entryIndex = profile.watchProgress.findIndex(propEq(mediaId, 'mediaId'));
    const updatedEntry: WatchProgressEntry = { mediaId, positionInMs, updatedAt: new Date() };
    if (entryIndex === -1) {
      profile.watchProgress.push(updatedEntry);
    } else {
      profile.watchProgress[entryIndex] = updatedEntry;
    }
    await this.model.findOneAndUpdate({ name: username }, { profiles: user.profiles }).exec();
    return true;
  };

  removeWatchProgress = (username: string, profileName: string, mediaId: string) =>
    this.model.findOneAndUpdate(
      { name: username, 'profiles.name': profileName },
      { $pull: { 'profiles.$.watchProgress': { mediaId } } }
    ).exec();

  addToWatchlist = (username: string, profileName: string, id: string, kind: WatchlistItemKind) =>
    this.model.findOneAndUpdate(
      { name: username, 'profiles.name': profileName },
      { $addToSet: { 'profiles.$.watchlist': { id, kind } } }
    ).exec();

  removeFromWatchlist = (username: string, profileName: string, id: string, kind: WatchlistItemKind) =>
    this.model.findOneAndUpdate(
      { name: username, 'profiles.name': profileName },
      { $pull: { 'profiles.$.watchlist': { id, kind } } }
    ).exec();

  deleteProfile = (name: string, profileName: string) =>
    this.model.findOneAndUpdate({ name }, { $pull: { profiles: { name: profileName } } }).exec();

  getUserProfiles = async (name: string): Promise<Profile[] | null> => {
    const user = await this.findUser(name);
    return isNil(user) ? null : user.profiles;
  };

  createPasswordResetRequestForUser = async (email: string, token: string): Promise<boolean> => {
    const emailVerified = await this.verifyEmail(email);
    if (!emailVerified) {
      return false;
    }
    const expiration = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    await this.model.findOneAndUpdate({ email }, { passwordResetRequest: { token, expiration } }).exec();
    return true;
  };

  findUserByPasswordResetToken = async (token: string): Promise<string | null> => {
    const user = await this.model.findOne({ "passwordResetRequest.token": token }).lean<User>().exec();
    if (isNil(user) || isNil(user.passwordResetRequest)) {
      return null;
    }
    const { expiration } = user.passwordResetRequest;
    if (expiration < new Date()) {
      return null;
    }
    return user.name;
  };

  resetUserPassword = (name: string, newPassword: string) =>
    this.model.findOneAndUpdate({ name }, { password: newPassword, $unset: { passwordResetRequest: "" } }).exec();
}
