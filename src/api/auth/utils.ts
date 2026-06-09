import { UnauthorizedError } from "@ido_kawaz/server-framework";
import { decode, verify } from "jsonwebtoken";
import { createPublicKey } from "node:crypto";
import { isNil, propEq } from "ramda";
import { UserProjection, validateUserProjection } from "../../dal/user/model";
import {
    AppleJwk,
    AppleUserName,
    DeviceTokenResult,
    validateAppleJwksResponse,
    validateAppleTokenPayload,
    validateAppleUserJson,
    validateGoogleDeviceCodeApiResponse,
    validateGoogleDeviceTokenApiResponse,
    validateGoogleTokenRequestResult,
} from "./types";

const fetchApplePublicKeys = async (): Promise<AppleJwk[]> => {
    const res = await fetch("https://appleid.apple.com/auth/keys");
    if (!res.ok) {
        throw new UnauthorizedError("Apple sign-in failed");
    }
    const { keys } = validateAppleJwksResponse(await res.json());
    return keys;
};

export const verifyAppleIdentityToken = async (identityToken: string, audience: string): Promise<{ sub: string; email: string }> => {
    const keys = await fetchApplePublicKeys();
    const decoded = decode(identityToken, { complete: true });
    if (isNil(decoded) || typeof decoded === "string") {
        throw new UnauthorizedError("Apple sign-in failed");
    }
    const { header: { kid } } = decoded;
    const jwk = keys.find(propEq(kid, "kid"));
    if (isNil(jwk)) {
        throw new UnauthorizedError("Apple sign-in failed");
    }
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    try {
        const payload = verify(identityToken, publicKey, { algorithms: ["RS256"], issuer: "https://appleid.apple.com", audience });
        return validateAppleTokenPayload(payload);
    } catch {
        throw new UnauthorizedError("Apple sign-in failed");
    }
};

export const parseAppleUserName = (userJson: unknown): AppleUserName => {
    try {
        const { name } = validateAppleUserJson(userJson);
        return { givenName: name?.firstName, familyName: name?.lastName };
    } catch {
        return {};
    }
};

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

