import { Router } from "@ido_kawaz/server-framework";
import { Dals } from "../../dal/types";
import { createMediaGenreHandlers } from "./handlers";
import { requireAdmin } from "../middleware";

export const createMediaGenreRouter = (
    dals: Dals
) => {
    const handlers = createMediaGenreHandlers(dals);
    const router = Router();

    /**
     * @openapi
     * /mediaGenre:
     *   get:
     *     summary: Get all media genres
     *     description: Returns all media genres from the database
     *     tags:
     *       - MediaGenre
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: List of media genres
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/MediaGenre'
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: No media genres found
     */
    router.get("/", handlers.getAllGenres);

    /**
     * @openapi
     * /mediaGenre/{genreId}:
     *   get:
     *     summary: Get a specific media genre
     *     description: Returns a single media genre by ID
     *     tags:
     *       - MediaGenre
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: genreId
     *         required: true
     *         schema:
     *           type: string
     *         description: Media genre ID
     *     responses:
     *       200:
     *         description: Media genre metadata
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MediaGenre'
     *       400:
     *         description: Bad request - invalid genre ID
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: Media genre not found
     */
    router.get("/:genreId", handlers.getGenre);

    /**
     * @openapi
     * /mediaGenre:
     *   post:
     *     summary: Create a new media genre
     *     description: Creates a new media genre. Requires admin privileges.
     *     tags:
     *       - MediaGenre
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *     responses:
     *       201:
     *         description: Media genre created successfully
     *       400:
     *         description: Bad request - invalid input data
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - admin only
     *       500:
     *         description: Internal server error
     */
    router.post("/", requireAdmin, handlers.createGenre);

    /**
     * @openapi
     * /mediaGenre:
     *   delete:
     *     summary: Delete a media genre
     *     description: Deletes a media genre from the database. Requires admin privileges.
     *     tags:
     *       - MediaGenre
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: genreId
     *         required: true
     *         schema:
     *           type: string
     *         description: Media genre ID
     *     responses:
     *       200:
     *         description: Media genre deleted successfully
     *       400:
     *         description: Bad request - invalid genre ID
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - admin only
     *       404:
     *         description: Media genre not found
     *       500:
     *         description: Internal server error
     */
    router.delete("/", requireAdmin, handlers.deleteGenre);

    return router;
}