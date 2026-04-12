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
     *                items:
     *                  type: object
     *                 properties:
     *                   name:
     *                    type: string
     *                  avatarId:
     *                   type: string
     *       400:   
     *         description: Invalid request body
     *       401:
     *         description: Missing or invalid token
     *       500:
     *         description: Internal server error
     */
    router.get("/profiles", userHandlers.getUserProfiles);

    return router;
};
