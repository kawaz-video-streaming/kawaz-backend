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
     * /contentRequest/tmdb/movie:
     *   get:
     *     summary: Look up a TMDB movie by title and year
     *     description: Returns the top matching TMDB movie's details, for picking a request target.
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
     *       - in: query
     *         name: year
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: The matching TMDB movie's details
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: No matching movie found
     */
    router.get("/tmdb/movie", handlers.getMovieTmdbDetails);

    /**
     * @openapi
     * /contentRequest/tmdb/show:
     *   get:
     *     summary: Look up a TMDB show by title and year
     *     description: Returns the top matching TMDB show's details, for picking a request target.
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
     *       - in: query
     *         name: year
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: The matching TMDB show's details
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: No matching show found
     */
    router.get("/tmdb/show", handlers.getShowTmdbDetails);

    /**
     * @openapi
     * /contentRequest/tmdb/season:
     *   get:
     *     summary: Look up a TMDB season by show title, show year, and season number
     *     description: Returns the matching TMDB season's details, for picking a specific season to request.
     *     tags:
     *       - ContentRequest
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: showTitle
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: showYear
     *         required: true
     *         schema:
     *           type: integer
     *       - in: query
     *         name: seasonNumber
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: The matching TMDB season's details
     *       401:
     *         description: Unauthorized
     *       404:
     *         description: No matching show found
     */
    router.get("/tmdb/season", handlers.getSeasonTmdbDetails);

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

    /**
     * @openapi
     * /contentRequest/{id}:
     *   delete:
     *     summary: Delete a content request
     *     description: Admins can delete any content request. Regular users can only delete their own request, and only while it's still in the "requested" status.
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
     *         description: Content request deleted
     *       401:
     *         description: Not authenticated, not the requester, or the request is no longer pending
     *       404:
     *         description: Content request not found
     */
    router.delete("/:id", handlers.deleteRequest);

    return router;
};
