import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@ido_kawaz/server-framework";
import bycrpt from "bcrypt";
import { sign } from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { isNil, isNotNil } from "ramda";
import { UserDal } from "../../dal/user";
import { APPROVED_STATUS } from "../../dal/user/model";
import { Mailer } from "../../services/mailer";
import { Role, USER_ROLE } from "../../utils/types";
import { AuthConfig, TokenPayload } from "./types";

const createUserTokenPayload = (
  username: string,
  role: Role = USER_ROLE,
): TokenPayload => ({ username, role });

export const createAuthLogic = (
  { jwtSecret, adminPromotionSecret }: AuthConfig,
  mailer: Mailer,
  userDal: UserDal,
) => ({
  signUp: async (username: string, password: string, email: string) => {
    const userExist = await userDal.verifyUser(username);
    if (userExist) {
      throw new ConflictError("Username already exists");
    }
    const passwordHash = await bycrpt.hash(password, 12);
    await userDal.createUser(username, passwordHash, email);
    await mailer.sendApprovalRequestEmail(username, email);
  },

  login: async (username: string, password: string) => {
    const user = await userDal.findUser(username);
    const passwordMatch = await bycrpt.compare(password, user?.password ?? "");
    if (isNil(user) || !passwordMatch || user.status !== APPROVED_STATUS) {
      throw new UnauthorizedError("Invalid username or password");
    }
    const token = sign(
      createUserTokenPayload(user.name, user.role),
      jwtSecret,
      { expiresIn: "2d" },
    );
    return token;
  },

  promoteAdmin: async (secret: string, username: string) => {
    if (secret !== adminPromotionSecret) {
      throw new UnauthorizedError("Invalid admin secret");
    }
    const promoted = await userDal.promoteToAdmin(username);
    if (!promoted) {
      throw new NotFoundError(`User "${username}" not found`);
    }
  },

  forgotPassword: async (email: string) => {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const created = await userDal.createPasswordResetRequestForUser(email, tokenHash);
    if (created) {
      await mailer.sendPasswordResetEmail(email, rawToken);
    }
  },

  resetPassword: async (resetToken: string, newPassword: string) => {
    const tokenHash = createHash("sha256").update(resetToken).digest("hex");
    const user = await userDal.findUserByPasswordResetToken(tokenHash);
    if (isNotNil(user)) {
      const newPasswordHash = await bycrpt.hash(newPassword, 12);
      await userDal.resetUserPassword(user, newPasswordHash);
    } else {
      throw new BadRequestError("Invalid or expired password reset token");
    }
  }
});
