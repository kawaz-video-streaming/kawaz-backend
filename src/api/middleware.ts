import { NextFunction, Request, Response } from "@ido_kawaz/server-framework";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserDal } from "../dal/user";

export const createLocalAuthMiddleware = (jwtSecret: string, userDal: UserDal) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authHeader = req.headers["authorization"];
        if (!authHeader?.startsWith("Bearer ")) {
            res.redirect("/auth/login");
            return;
        }
        try {
            const token = authHeader.split(" ")[1];
            const payload = jwt.verify(token, jwtSecret) as JwtPayload;
            const userExists: boolean = await userDal.verifyUser(payload.username); // Verify user exists
            if (!userExists) {
                res.redirect("/auth/login");
            }
            next();
        } catch {
            res.redirect("/auth/login");
        }
    }

export const createAuthMiddleware = (jwtSecret: string, userDal: UserDal) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authHeader = req.headers["authorization"];
        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        try {
            const token = authHeader.split(" ")[1];
            const payload = jwt.verify(token, jwtSecret) as JwtPayload;
            const userExists: boolean = await userDal.verifyUser(payload.username); // Verify user exists
            if (!userExists) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            next();
        } catch {
            res.status(401).json({ message: "Invalid or expired token" });
        }
    }