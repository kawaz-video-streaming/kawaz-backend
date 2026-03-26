import { ConflictError, UnauthorizedError } from "@ido_kawaz/server-framework";
import bycrpt from "bcrypt";
import { sign } from "jsonwebtoken";
import { isNil } from "ramda";
import { UserDal } from "../../dal/user";

export const createAuthLogic = (
  jwtSecret: string,
  userDal: UserDal
) => ({
  signUp: async (username: string, password: string) => {
    const userExist = await userDal.verifyUser(username);
    if (userExist) {
      throw new ConflictError("Username already exists");
    }
    const passwordHash = await bycrpt.hash(password, 12);
    await userDal.createUser(username, passwordHash);
    const token = sign({ username }, jwtSecret, { expiresIn: '2d' });
    return token;
  },

  login: async (username: string, password: string) => {
    const user = await userDal.findUser(username);
    const passwordMatch = await bycrpt.compare(password, user?.password ?? '');
    if (isNil(user) || !passwordMatch) {
      throw new UnauthorizedError("Invalid username or password");
    }
    const token = sign({ username }, jwtSecret, { expiresIn: '2d' });
    return token;
  }
});
