import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@ido_kawaz/server-framework";
import bcrypt from "bcrypt";
import * as jsonwebtoken from "jsonwebtoken";
import { UserDal } from "../../../dal/user";
import { Mailer } from "../../../services/mailer";
import { createAuthLogic } from "../logic";
import { USER_ROLE } from "../../../utils/types";

jest.mock("bcrypt");
jest.mock("jsonwebtoken");
jest.mock("../utils");

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSign = jsonwebtoken.sign as jest.Mock;

import { fetchGoogleAccessToken, fetchGoogleUserInfo } from "../utils";
const mockedFetchGoogleAccessToken = fetchGoogleAccessToken as jest.Mock;
const mockedFetchGoogleUserInfo = fetchGoogleUserInfo as jest.Mock;

const AUTH_CONFIG = {
  jwtSecret: "test-secret",
  adminPromotionSecret: "test-admin-secret",
  googleClientId: "test-google-client-id",
  googleClientSecret: "test-google-client-secret",
  appDomain: "http://localhost:3000",
};

const makeUserDal = (
  overrides: Partial<Record<keyof UserDal, jest.Mock>> = {},
) =>
  ({
    verifyUser: jest.fn(),
    createUser: jest.fn(),
    findUser: jest.fn(),
    findUserByEmail: jest.fn(),
    promoteToAdmin: jest.fn(),
    createPasswordResetRequestForUser: jest.fn(),
    findUserByPasswordResetToken: jest.fn(),
    resetUserPassword: jest.fn(),
    ...overrides,
  }) as unknown as UserDal;

const makeMailer = (overrides: Partial<Record<keyof Mailer, jest.Mock>> = {}) =>
  ({
    sendApprovalRequestEmail: jest.fn().mockResolvedValue(undefined),
    sendApprovalEmail: jest.fn().mockResolvedValue(undefined),
    sendDenialEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as Mailer;

describe("createAuthLogic.signUp", () => {
  it("throws ConflictError when username already exists", async () => {
    const userDal = makeUserDal({
      verifyUser: jest.fn().mockResolvedValue(true),
    });
    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(
      logic.signUp("ido", "strongpassword123", "dummyemail@example.com"),
    ).rejects.toThrow(ConflictError);
    expect(userDal.createUser).not.toHaveBeenCalled();
  });

  it("hashes password, creates user, and sends approval request email", async () => {
    const userDal = makeUserDal({
      verifyUser: jest.fn().mockResolvedValue(false),
      createUser: jest.fn().mockResolvedValue(undefined),
    });
    mockedBcrypt.hash.mockResolvedValue("hashed-password" as never);
    const mailer = makeMailer();

    const logic = createAuthLogic(AUTH_CONFIG, mailer, userDal);
    const result = await logic.signUp(
      "ido",
      "strongpassword123",
      "dummyemail@example.com",
    );

    expect(mockedBcrypt.hash).toHaveBeenCalledWith("strongpassword123", 12);
    expect(userDal.createUser).toHaveBeenCalledWith(
      "ido",
      "hashed-password",
      "dummyemail@example.com",
    );
    expect(mailer.sendApprovalRequestEmail).toHaveBeenCalledWith(
      "ido",
      "dummyemail@example.com",
    );
    expect(mockedSign).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

describe("createAuthLogic.login", () => {
  it("throws UnauthorizedError when user does not exist", async () => {
    const userDal = makeUserDal({
      findUser: jest.fn().mockResolvedValue(null),
    });
    mockedBcrypt.compare.mockResolvedValue(false as never);

    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.login("ido", "strongpassword123")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("throws UnauthorizedError when password does not match", async () => {
    const userDal = makeUserDal({
      findUser: jest.fn().mockResolvedValue({
        name: "ido",
        password: "hashed-password",
        role: USER_ROLE,
        status: "approved",
      }),
    });
    mockedBcrypt.compare.mockResolvedValue(false as never);

    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.login("ido", "wrongpassword123")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("throws UnauthorizedError when user is not approved", async () => {
    const userDal = makeUserDal({
      findUser: jest.fn().mockResolvedValue({
        name: "ido",
        password: "hashed-password",
        role: USER_ROLE,
        status: "pending",
      }),
    });
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.login("ido", "strongpassword123")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("returns token with the user role from DB", async () => {
    const userDal = makeUserDal({
      findUser: jest.fn().mockResolvedValue({
        name: "ido",
        password: "hashed-password",
        role: USER_ROLE,
        status: "approved",
      }),
    });
    mockedBcrypt.compare.mockResolvedValue(true as never);
    mockedSign.mockReturnValue("signed-token");

    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);
    const token = await logic.login("ido", "strongpassword123");

    expect(mockedSign).toHaveBeenCalledWith(
      { username: "ido", role: USER_ROLE },
      AUTH_CONFIG.jwtSecret,
      { expiresIn: "2d" },
    );
    expect(token).toBe("signed-token");
  });
});

describe("createAuthLogic.promoteAdmin", () => {
  it("throws UnauthorizedError when secret is wrong", async () => {
    const userDal = makeUserDal();
    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.promoteAdmin("wrong-secret", "ido")).rejects.toThrow(
      UnauthorizedError,
    );
    expect(userDal.promoteToAdmin).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when user does not exist", async () => {
    const userDal = makeUserDal({
      promoteToAdmin: jest.fn().mockResolvedValue(false),
    });
    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(
      logic.promoteAdmin(AUTH_CONFIG.adminPromotionSecret, "unknown"),
    ).rejects.toThrow(NotFoundError);
  });

  it("promotes user when secret and username are valid", async () => {
    const userDal = makeUserDal({
      promoteToAdmin: jest.fn().mockResolvedValue(true),
    });
    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(
      logic.promoteAdmin(AUTH_CONFIG.adminPromotionSecret, "ido"),
    ).resolves.toBeUndefined();
    expect(userDal.promoteToAdmin).toHaveBeenCalledWith("ido");
  });
});

describe("createAuthLogic.forgotPassword", () => {
  it("does not send email when email is not registered", async () => {
    const mailer = makeMailer();
    const userDal = makeUserDal({
      createPasswordResetRequestForUser: jest.fn().mockResolvedValue(false),
    });
    const logic = createAuthLogic(AUTH_CONFIG, mailer, userDal);

    await expect(logic.forgotPassword("unknown@example.com")).resolves.toBeUndefined();
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stores a hashed token and sends the raw token by email", async () => {
    const mailer = makeMailer();
    const userDal = makeUserDal({
      createPasswordResetRequestForUser: jest.fn().mockResolvedValue(true),
    });
    const logic = createAuthLogic(AUTH_CONFIG, mailer, userDal);

    await logic.forgotPassword("ido@example.com");

    const [emailArg, rawToken] = (mailer.sendPasswordResetEmail as jest.Mock).mock.calls[0];
    const [, storedHash] = (userDal.createPasswordResetRequestForUser as jest.Mock).mock.calls[0];

    expect(emailArg).toBe("ido@example.com");
    expect(rawToken).not.toBe(storedHash);
    expect(storedHash).toHaveLength(64); // SHA-256 hex
    expect(rawToken).toHaveLength(64);   // 32 randomBytes as hex
  });
});

describe("createAuthLogic.googleCallback", () => {
  beforeEach(() => {
    mockedFetchGoogleAccessToken.mockResolvedValue("access-token");
    mockedFetchGoogleUserInfo.mockResolvedValue({ name: "John Doe", email: "john@gmail.com" });
  });

  it("returns token for an approved existing user", async () => {
    const userDal = makeUserDal({
      findUserByEmail: jest.fn().mockResolvedValue({ name: "John Doe", email: "john@gmail.com", role: USER_ROLE, status: "approved" }),
    });
    mockedSign.mockReturnValue("signed-token");

    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);
    const token = await logic.googleCallback("auth-code");

    expect(token).toBe("signed-token");
    expect(mockedSign).toHaveBeenCalledWith({ username: "John Doe", role: USER_ROLE }, AUTH_CONFIG.jwtSecret, { expiresIn: "2d" });
  });

  it("throws UnauthorizedError for a non-approved existing user", async () => {
    const userDal = makeUserDal({
      findUserByEmail: jest.fn().mockResolvedValue({ name: "John Doe", email: "john@gmail.com", role: USER_ROLE, status: "pending" }),
    });

    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.googleCallback("auth-code")).rejects.toThrow(UnauthorizedError);
    expect(mockedSign).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the Google display name is already taken", async () => {
    const userDal = makeUserDal({
      findUserByEmail: jest.fn().mockResolvedValue(null),
      verifyUser: jest.fn().mockResolvedValue(true),
    });

    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.googleCallback("auth-code")).rejects.toThrow(ConflictError);
    expect(userDal.createUser).not.toHaveBeenCalled();
  });

  it("creates user with a placeholder password and sends approval email for a new user", async () => {
    const mailer = makeMailer();
    const userDal = makeUserDal({
      findUserByEmail: jest.fn().mockResolvedValue(null),
      verifyUser: jest.fn().mockResolvedValue(false),
      createUser: jest.fn().mockResolvedValue(undefined),
    });
    mockedBcrypt.hash.mockResolvedValue("placeholder-hash" as never);

    const logic = createAuthLogic(AUTH_CONFIG, mailer, userDal);
    const result = await logic.googleCallback("auth-code");

    expect(result).toBeNull();
    expect(userDal.createUser).toHaveBeenCalledWith("John Doe", "placeholder-hash", "john@gmail.com");
    expect(mailer.sendApprovalRequestEmail).toHaveBeenCalledWith("John Doe", "john@gmail.com");
  });
});

describe("createAuthLogic.resetPassword", () => {
  it("throws BadRequestError when token is invalid or expired", async () => {
    const userDal = makeUserDal({
      findUserByPasswordResetToken: jest.fn().mockResolvedValue(null),
    });
    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.resetPassword("invalid-token", "newpassword123")).rejects.toThrow(BadRequestError);
    expect(userDal.resetUserPassword).not.toHaveBeenCalled();
  });

  it("hashes new password and resets it when token is valid", async () => {
    const userDal = makeUserDal({
      findUserByPasswordResetToken: jest.fn().mockResolvedValue("ido"),
      resetUserPassword: jest.fn().mockResolvedValue(undefined),
    });
    mockedBcrypt.hash.mockResolvedValue("new-hashed-password" as never);
    const logic = createAuthLogic(AUTH_CONFIG, makeMailer(), userDal);

    await expect(logic.resetPassword("valid-token", "newpassword123")).resolves.toBeUndefined();
    expect(mockedBcrypt.hash).toHaveBeenCalledWith("newpassword123", 12);
    expect(userDal.resetUserPassword).toHaveBeenCalledWith("ido", "new-hashed-password");
  });
});
