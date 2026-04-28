import { Router } from "@ido_kawaz/server-framework";
import { UserDal } from "../../dal/user";
import { createAuthHandlers } from "./handlers";
import { AuthConfig } from "./types";
import { Mailer } from "../../services/mailer";

export const createAuthRouter = (authConfig: AuthConfig, mailer: Mailer, userDal: UserDal) => {
  const authHandlers = createAuthHandlers(authConfig, mailer, userDal);
  const router = Router();

  /**
   * @openapi
   * /auth/signup:
   *   post:
   *     summary: Register a new user
   *     description: Creates a new user account and returns a signed JWT token
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 minLength: 3
   *                 description: Unique username
   *               password:
   *                 type: string
   *                 minLength: 12
   *                 description: Password (min 12 characters, max 72)
   *     responses:
   *       201:
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   description: Signed JWT token (expires in 2 days)
   *       400:
   *         description: Invalid request body
   *       409:
   *         description: Username already exists
   */
  router.post("/signup", authHandlers.signUp);

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     summary: Log in to an existing account
   *     description: Validates credentials and returns a signed JWT token
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   description: Signed JWT token (expires in 2 days)
   *       400:
   *         description: Invalid request body
   *       401:
   *         description: Invalid username or password
   */
  router.post("/login", authHandlers.login);

  /**
   * @openapi
   * /auth/promote:
   *   post:
   *     summary: Promote a user to admin
   *     description: Promotes a user to the admin role. Requires the x-admin-secret header with the correct secret.
   *     tags:
   *       - Auth
   *     parameters:
   *       - in: header
   *         name: x-admin-secret
   *         required: true
   *         schema:
   *           type: string
   *         description: Admin promotion secret
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *             properties:
   *               username:
   *                 type: string
   *                 description: Username to promote to admin
   *     responses:
   *       200:
   *         description: User promoted to admin successfully
   *       400:
   *         description: Missing header or invalid request body
   *       401:
   *         description: Invalid admin secret
   *       404:
   *         description: User not found
   */
  router.post("/promote", authHandlers.promoteAdmin);


  /**
   * @openapi
   * /auth/forgot-password:
   *   post:
   *     summary: Request a password reset
   *     description: >
   *       Generates a cryptographically random token, stores its SHA-256 hash on the user,
   *       and emails the raw token to the given address. Always returns 200 regardless of
   *       whether the email is registered, to avoid leaking account existence.
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Email address associated with the account
   *     responses:
   *       200:
   *         description: Request processed (email sent if account exists)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: If an account with that email exists, a password reset email has been sent
   *       400:
   *         description: Invalid request body
   */
  router.post("/forgot-password", authHandlers.forgotPassword);

  /**
   * @openapi
   * /auth/reset-password:
   *   post:
   *     summary: Reset a user's password
   *     description: Resets a user's password using a valid reset token.
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - newPassword
   *             properties:
   *               token:
   *                 type: string
   *                 description: Password reset token
   *               newPassword:
   *                 type: string
   *                 description: New password (minimum 12 characters)
   *     responses:
   *       200:
   *         description: Password reset successful
   *       400:
   *         description: Invalid request body
   */
  router.post("/reset-password", authHandlers.resetPassword);

  return router;
};
