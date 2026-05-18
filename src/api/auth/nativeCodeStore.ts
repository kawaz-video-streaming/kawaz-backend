import { randomBytes } from "node:crypto";

const store = new Map<string, string>();

export const storeNativeCode = (jwt: string): string => {
  const code = randomBytes(32).toString("hex");
  store.set(code, jwt);
  setTimeout(() => store.delete(code), 60_000);
  return code;
};

export const popNativeCode = (code: string): string | null => {
  const jwt = store.get(code) ?? null;
  store.delete(code);
  return jwt;
};
