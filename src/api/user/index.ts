import { Router } from "@ido_kawaz/server-framework";
import { UserDal } from "../../dal/user";
import { createUserHandlers } from './handlers';

export const createUserRouter = (userDal: UserDal) => {
    const userHandlers = createUserHandlers(userDal);
    const router = Router();
    /**
     * @openapi
     * /user/me:
     *   get:
     *     summary: Get current user info
     *     description: Returns the user's username and role.
     *     tags:
     *       - Auth
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Authenticated user info
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 username:
     *                   type: string
     *                 role:
     *                   type: string
     *                   enum:
     *                     - user
     *                     - admin
     *       401:
     *         description: Missing or invalid token
     */
    router.get("/me", userHandlers.me);

    /**
     * @openapi
     * /user/profile:
     *   post:
     *     summary: Create a new user profile
     *     description: Creates a new profile for the user.
     *     tags:
     *       - Auth
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               profileName:
     *                 type: string
     *               avatarId:
     *                 type: string
     *     responses:
     *       200: 
     *         description: New profile created successfully
     *       400:   
     *         description: Invalid request body
     *       401:
     *         description: Missing or invalid token
     *       500:
     *         description: Internal server error
     */
    router.post("/profile", userHandlers.createProfile);

    /**
     * @openapi
     * /user/profile:
     *   put:
     *     summary: update the profile avatar
     *     description: Updates the avatar of an existing profile for the user.
     *     tags:
     *       - Auth
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               profileName:
     *                 type: string
     *               avatarId:
     *                 type: string
     *     responses:
     *       200: 
     *         description: Profile avatar updated successfully
     *       400:   
     *         description: Invalid request body
     *       401:
     *         description: Missing or invalid token
     *       500:
     *         description: Internal server error
     */
    router.put("/profile", userHandlers.updateProfileAvatar);

    /**
     * @openapi
     * /user/profile:
     *   delete:
     *     summary: Delete a user profile
     *     description: Deletes a user profile.
     *     tags:
     *       - Auth
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200: 
     *         description: Profile deleted successfully
     *       400:   
     *         description: Invalid request body
     *       401:
     *         description: Missing or invalid token
     *       500:
     *         description: Internal server error
     */
    router.delete("/profile/:name", userHandlers.deleteProfile);

    /**
     * @openapi
     * /user/profiles:
     *   get:
     *     summary: Get user profiles
     *     description: Retrieves all profiles for the user.
     *     tags:
     *       - Auth
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200: 
     *         description: the profiles of the user
     *         content:
     *           application/json:
     *             schema:
     *              type: object
     *              properties:
     *                profiles:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     name:
     *                       type: string
     *                     avatarId:
     *                       type: string
     *       400:   
     *         description: Invalid request body
     *       401:
     *         description: Missing or invalid token
     *       500:
     *         description: Internal server error
     */
    router.get("/profiles", userHandlers.getUserProfiles);

    /**
     * @openapi
     * /user/account:
     *   delete:
     *     summary: Delete the authenticated user's account
     *     description: Permanently deletes the user's account record, email, hashed password, and all profiles. Clears the session cookie. This action is irreversible.
     *     tags:
     *       - Auth
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Account deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: Account deleted successfully
     *       401:
     *         description: Missing or invalid token
     *       500:
     *         description: Internal server error
     */
    router.delete("/account", userHandlers.deleteAccount);

    /**
     * @openapi
     * /user/profile/{profileName}/progress:
     *   put:
     *     summary: Upsert watch progress for a media item
     *     tags: [User]
     *     security: [{ cookieAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: profileName
     *         required: true
     *         schema: { type: string }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               mediaId: { type: string }
     *               positionInMs: { type: number }
     *     responses:
     *       200: { description: Watch progress updated }
     *       401: { description: Unauthorized }
     *       404: { description: Profile not found }
     */
    router.put("/profile/:profileName/progress", userHandlers.upsertWatchProgress);

    /**
     * @openapi
     * /user/profile/{profileName}/progress/{mediaId}:
     *   delete:
     *     summary: Remove watch progress for a media item
     *     tags: [User]
     *     security: [{ cookieAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: profileName
     *         required: true
     *         schema: { type: string }
     *       - in: path
     *         name: mediaId
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200: { description: Watch progress removed }
     *       401: { description: Unauthorized }
     */
    router.delete("/profile/:profileName/progress/:mediaId", userHandlers.removeWatchProgress);

    /**
     * @openapi
     * /user/profile/{profileName}/continue-watching:
     *   get:
     *     summary: Get in-progress media for a profile, newest first
     *     tags: [User]
     *     security: [{ cookieAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: profileName
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200: { description: List of in-progress media with positionInMs }
     *       401: { description: Unauthorized }
     */
    router.get("/profile/:profileName/continue-watching", userHandlers.getContinueWatching);

    /**
     * @openapi
     * /user/profile/{profileName}/watchlist/{mediaId}:
     *   post:
     *     summary: Add a media item to the profile watchlist
     *     tags: [User]
     *     security: [{ cookieAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: profileName
     *         required: true
     *         schema: { type: string }
     *       - in: path
     *         name: mediaId
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200: { description: Added to watchlist }
     *       401: { description: Unauthorized }
     */
    router.post("/profile/:profileName/watchlist/:mediaId", userHandlers.addToWatchlist);

    /**
     * @openapi
     * /user/profile/{profileName}/watchlist/{mediaId}:
     *   delete:
     *     summary: Remove a media item from the profile watchlist
     *     tags: [User]
     *     security: [{ cookieAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: profileName
     *         required: true
     *         schema: { type: string }
     *       - in: path
     *         name: mediaId
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200: { description: Removed from watchlist }
     *       401: { description: Unauthorized }
     */
    router.delete("/profile/:profileName/watchlist/:mediaId", userHandlers.removeFromWatchlist);

    /**
     * @openapi
     * /user/profile/{profileName}/watchlist:
     *   get:
     *     summary: Get the profile watchlist
     *     tags: [User]
     *     security: [{ cookieAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: profileName
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200: { description: List of media in the watchlist }
     *       401: { description: Unauthorized }
     */
    router.get("/profile/:profileName/watchlist", userHandlers.getWatchlist);

    return router;
};
