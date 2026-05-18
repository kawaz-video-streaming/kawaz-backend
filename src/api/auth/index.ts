import { Router } from "@ido_kawaz/server-framework";
import { UserDal } from "../../dal/user";
import { Mailer } from "../../services/mailer";
import { createAuthHandlers } from "./handlers";
import { AuthConfig } from "./types";

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
   * /auth/google/login:
   *   get:
   *     summary: Initiate Google OAuth login
   *     description: Redirects the browser to Google's OAuth consent screen.
   *     tags:
   *       - Auth
   *     responses:
   *       302:
   *         description: Redirect to Google's OAuth consent screen
   */
  router.get('/google/login', authHandlers.googleLogin);

  /**
   * @openapi
   * /auth/google/callback:
   *   get:
   *     summary: Google OAuth callback
   *     description: >
   *       Exchanges the Google authorization code for user info.
   *       If the user is approved, sets the auth cookie and returns 200.
   *       If the user is new or pending, creates/awaits admin approval and returns 202.
   *     tags:
   *       - Auth
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Authorization code returned by Google
   *     responses:
   *       200:
   *         description: Login successful — kawaz-token cookie set
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Login successful
   *       202:
   *         description: Account created or pending — awaiting admin approval
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Signup finished. Your account is awaiting admin approval
   *       400:
   *         description: Missing or invalid code parameter
   *       401:
   *         description: Google authentication failed or account denied
   */
  router.get('/google/callback', authHandlers.googleCallback);

  /**
   * @openapi
   * /auth/google/device/start:
   *   post:
   *     summary: Start a Google device authorization flow
   *     description: >
   *       Initiates the OAuth 2.0 Device Authorization Grant (RFC 8628) for input-constrained
   *       devices such as Android TV. Returns a user code and verification URL that the user
   *       enters on a secondary device to approve the login. Poll /auth/google/device/poll
   *       with the returned device_code to check for authorization.
   *     tags:
   *       - Auth
   *     responses:
   *       200:
   *         description: Device authorization initiated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 deviceCode:
   *                   type: string
   *                   description: Opaque code used to poll for authorization status
   *                 userCode:
   *                   type: string
   *                   description: Short code the user enters on the verification page (e.g. ABCD-1234)
   *                 verificationUrl:
   *                   type: string
   *                   description: URL the user visits to enter the user code
   *                 expiresIn:
   *                   type: number
   *                   description: Seconds until the device code expires
   *                 interval:
   *                   type: number
   *                   description: Minimum seconds to wait between poll requests
   *       401:
   *         description: Failed to initiate device authorization with Google
   */
  router.post('/google/device/start', authHandlers.googleDeviceStart);

  /**
   * @openapi
   * /auth/google/device/poll:
   *   get:
   *     summary: Poll for Google device authorization status
   *     description: >
   *       Polls Google's token endpoint using the device_code returned by /auth/google/device/start.
   *       Returns pending or slow_down while the user has not yet approved. On authorization,
   *       finds or creates the user account and sets the kawaz-token cookie. If the account is
   *       new or awaiting admin approval, returns pending without a cookie.
   *     tags:
   *       - Auth
   *     parameters:
   *       - in: query
   *         name: device_code
   *         required: true
   *         schema:
   *           type: string
   *         description: Device code returned by /auth/google/device/start
   *     responses:
   *       200:
   *         description: Current authorization status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - status
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [pending, slow_down, approved, denied]
   *                 username:
   *                   type: string
   *                   description: Present when status is authorized
   *                 role:
   *                   type: string
   *                   description: Present when status is authorized
   *       400:
   *         description: Missing or invalid device_code
   *       401:
   *         description: User denied access or device code expired
   */
  router.get('/google/device/poll', authHandlers.googleDevicePoll);

  /**
   * @openapi
   * /auth/google/native/exchange:
   *   post:
   *     summary: Exchange a native OAuth code for a session cookie
   *     description: >
   *       Completes the native Android OAuth flow. After the browser redirects back to the app
   *       with a short-lived one-time code (com.kawaz.plus://auth/callback?code=...), the app
   *       posts that code here to receive the kawaz-token session cookie. The code expires after
   *       60 seconds and is invalidated on first use.
   *     tags:
   *       - Auth
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - code
   *             properties:
   *               code:
   *                 type: string
   *                 description: One-time code received in the native app URL callback
   *     responses:
   *       200:
   *         description: Login successful — kawaz-token cookie set
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Login successful
   *       400:
   *         description: Missing or invalid request body
   *       401:
   *         description: Code is invalid or has expired
   */
  router.post('/google/native/exchange', authHandlers.googleNativeExchange);

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
