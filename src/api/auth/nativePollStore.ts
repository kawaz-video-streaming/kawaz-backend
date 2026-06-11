import { PollEntry, ResolvedPollEntry } from "./types";

const store = new Map<string, PollEntry>()
const TTL_MS = 5 * 60 * 1_000

export const initNonce = (nonce: string): void => {
  store.set(nonce, { status: 'pending' })
  setTimeout(() => store.delete(nonce), TTL_MS)
}

export const resolveNonce = (nonce: string, result: ResolvedPollEntry): void => {
  if (store.has(nonce)) {
    store.set(nonce, result)
  }
}

export const pollNonce = (nonce: string): PollEntry | undefined =>
  store.get(nonce)
