import { UnauthorizedError } from "@ido_kawaz/server-framework";
import { UserProjection, validateUserProjection } from "../../dal/user/model";
import { validateGoogleTokenRequestResult } from "./types";

export const fetchGoogleAccessToken = async (code: string, googleClientId: string, googleClientSecret: string, appDomain: string): Promise<string> => {
    const googleTokenRequestResult = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: googleClientId,
            client_secret: googleClientSecret,
            redirect_uri: `${appDomain}/auth/google/callback`,
            grant_type: "authorization_code",
        }),
    });
    if (!googleTokenRequestResult.ok) {
        throw new UnauthorizedError("Google authentication failed");
    }
    const { access_token: accessToken } = validateGoogleTokenRequestResult(await googleTokenRequestResult.json());
    return accessToken;
};

export const fetchGoogleUserInfo = async (accessToken: string): Promise<UserProjection> => {
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) {
        throw new UnauthorizedError("Google authentication failed");
    }
    const userProjection = validateUserProjection(await userInfoRes.json());
    return userProjection;
}
