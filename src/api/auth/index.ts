import { Router } from "@ido_kawaz/server-framework";
import { UserDal } from "../../dal/user";
import { createAuthHandlers } from "./handlers";
import { AuthConfig } from "./types";

export const createAuthRouter = (authConfig: AuthConfig, userDal: UserDal) => {
  const authHandlers = createAuthHandlers(authConfig, userDal);
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

  return router;
};
