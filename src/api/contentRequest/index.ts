import { Router } from "@ido_kawaz/server-framework";
import { Dals } from "../../dal/types";
import { Mailer } from "../../services/mailer";
import { TmdbClient } from "../../services/tmdbClient";
import { requireAdmin, requireRegularUser } from "../middleware";
import { createContentRequestHandlers } from "./handlers";

export const createContentRequestRouter = (dals: Dals, mailer: Mailer, tmdbClient: TmdbClient) => {
    const handlers = createContentRequestHandlers(dals, mailer, tmdbClient);
    const router = Router();

    /**
     * @openapi
     * /contentRequest/tmdb/search/movie:
     *   get:
     *     summary: Search TMDB for movies
     *     description: Returns a list of TMDB movie search results for picking a request target.
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: title
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: List of matching TMDB movies
     *       401:
     *         description: Unauthorized
     */
    router.get("/tmdb/search/movie", handlers.searchMovies);

    /**
     * @openapi
     * /contentRequest/tmdb/search/show:
     *   get:
     *     summary: Search TMDB for shows
     *     description: Returns a list of TMDB TV show search results for picking a request target.
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: title
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: List of matching TMDB shows
     *       401:
     *         description: Unauthorized
     */
    router.get("/tmdb/search/show", handlers.searchShows);

    /**
     * @openapi
     * /contentRequest/tmdb/show/{showId}/seasons:
     *   get:
     *     summary: List a TMDB show's seasons
     *     description: Returns the season list (name, poster, episode count) for a TMDB show, for picking which season to request.
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: showId
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: List of the show's seasons
     *       401:
     *         description: Unauthorized
     */
    router.get("/tmdb/show/:showId/seasons", handlers.getShowSeasons);

    /**
     * @openapi
     * /contentRequest:
     *   post:
     *     summary: Submit a content request
     *     description: Creates a new content request for the authenticated user. Regular users only (not special/admin).
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       201:
     *         description: Content request created
     *       400:
     *         description: Invalid request body
     *       401:
     *         description: Unauthorized or not a regular user
     */
    router.post("/", requireRegularUser, handlers.createRequest);

    /**
     * @openapi
     * /contentRequest/mine:
     *   get:
     *     summary: List my content requests
     *     description: Returns all content requests submitted by the authenticated user.
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: List of the user's content requests
     *       401:
     *         description: Unauthorized
     */
    router.get("/mine", requireRegularUser, handlers.getMyRequests);

    /**
     * @openapi
     * /contentRequest:
     *   get:
     *     summary: List all content requests
     *     description: Returns all content requests across all users. Requires admin role.
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: List of all content requests
     *       401:
     *         description: Not authenticated or not authorized (admin only)
     */
    router.get("/", requireAdmin, handlers.getAllRequests);

    /**
     * @openapi
     * /contentRequest/{id}/status:
     *   patch:
     *     summary: Update a content request's status
     *     description: Transitions a content request to acknowledged/uploaded/rejected/failed. Requires admin role. Terminal statuses (uploaded/rejected/failed) email the requester.
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Content request updated
     *       400:
     *         description: Invalid request body
     *       401:
     *         description: Not authenticated or not authorized (admin only)
     *       404:
     *         description: Content request not found
     */
    router.patch("/:id/status", requireAdmin, handlers.updateStatus);

    return router;
};
