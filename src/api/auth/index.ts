import { Router } from "@ido_kawaz/server-framework";
import { UserDal } from "../../dal/user";
import { createAuthHandlers } from "./handlers"

export const createAuthRouter = (jwtSecret: string, userDal: UserDal) => {
  const authHandlers = createAuthHandlers(jwtSecret, userDal);
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

  return router;
};
