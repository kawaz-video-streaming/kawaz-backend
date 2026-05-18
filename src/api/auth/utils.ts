import { UnauthorizedError } from "@ido_kawaz/server-framework";
import { UserProjection, validateUserProjection } from "../../dal/user/model";
import {
    DeviceTokenResult,
    validateGoogleDeviceCodeApiResponse,
    validateGoogleDeviceTokenApiResponse,
    validateGoogleTokenRequestResult,
} from "./types";

export const fetchGoogleAccessToken = async (code: string, googleClientId: string, googleClientSecret: string, appDomain: string): Promise<string> => {
    const googleTokenRequestResult = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: googleClientId,
            client_secret: googleClientSecret,
            redirect_uri: `${appDomain}/api/auth/google/callback`,
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
};

export const fetchGoogleDeviceCode = async (clientId: string) => {
    const res = await fetch("https://oauth2.googleapis.com/device/code", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            scope: "openid email profile",
        }),
    });
    if (!res.ok) {
        throw new UnauthorizedError("Failed to initiate device authorization");
    }
    return validateGoogleDeviceCodeApiResponse(await res.json());
};

export const fetchGoogleDeviceToken = async (
    clientId: string,
    clientSecret: string,
    deviceCode: string,
): Promise<DeviceTokenResult> => {
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
    });
    const body = await res.json()
        .then(validateGoogleDeviceTokenApiResponse)
        .catch(() => { throw new UnauthorizedError("Google device authentication failed"); });
    if ("access_token" in body) {
        return { status: "authorized", accessToken: body.access_token };
    } else if (body.error === "authorization_pending") {
        return { status: "pending" };
    } else if (body.error === "slow_down") {
        return { status: "slow_down" };
    }
    throw new UnauthorizedError("Google device authentication failed");
};

