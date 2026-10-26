const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const KEYS = {
  access: "music-explorer.spotify.access-token",
  refresh: "music-explorer.spotify.refresh-token",
  expiry: "music-explorer.spotify.expires-at",
  transaction: "music-explorer.spotify.pkce-transaction",
} as const;
const SCOPES = ["user-read-playback-state", "user-modify-playback-state"];

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type FetchLike = typeof fetch;

interface OAuthTransaction {
  state: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

function session(): StorageLike {
  if (typeof window === "undefined")
    throw new Error("Spotify sign-in requires a browser session.");
  return window.sessionStorage;
}

function randomString(bytes = 64): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

async function challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function validateRedirectUri(redirectUri: string): void {
  const redirect = new URL(redirectUri);
  const localHost =
    redirect.hostname === "localhost" ||
    redirect.hostname.endsWith(".localhost");
  if (localHost)
    throw new Error(
      "Spotify callbacks must use HTTPS or a loopback IP address, not localhost.",
    );
  if (
    redirect.protocol !== "https:" &&
    !(redirect.protocol === "http:" && redirect.hostname === "127.0.0.1")
  ) {
    throw new Error(
      "Spotify callback must use HTTPS or http://127.0.0.1 for local development.",
    );
  }
}

export async function beginLogin(
  clientId: string,
  redirectUri: string,
): Promise<string> {
  if (!clientId.trim()) throw new Error("Spotify client ID is required.");
  validateRedirectUri(redirectUri);
  const storage = session();
  const transaction: OAuthTransaction = {
    state: randomString(24),
    verifier: randomString(48),
    clientId,
    redirectUri,
  };
  storage.setItem(KEYS.transaction, JSON.stringify(transaction));
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: await challenge(transaction.verifier),
    state: transaction.state,
    scope: SCOPES.join(" "),
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function exchangeToken(
  body: URLSearchParams,
  fetcher: FetchLike,
): Promise<TokenResponse> {
  const response = await fetcher(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok)
    throw new Error(`Spotify sign-in failed (${response.status}).`);
  return (await response.json()) as TokenResponse;
}

function storeTokens(tokens: TokenResponse, storage: StorageLike): void {
  storage.setItem(KEYS.access, tokens.access_token);
  storage.setItem(KEYS.expiry, String(Date.now() + tokens.expires_in * 1000));
  if (tokens.refresh_token) storage.setItem(KEYS.refresh, tokens.refresh_token);
}

export async function completeLogin(
  location: Pick<Location, "search" | "href"> = window.location,
  history: Pick<History, "replaceState"> = window.history,
  fetcher: FetchLike = fetch,
): Promise<void> {
  const params = new URLSearchParams(location.search);
  const oauthError = params.get("error");
  const code = params.get("code");
  const returnedState = params.get("state");
  if (!code && !oauthError)
    throw new Error("Spotify callback has no authorization code.");
  const storage = session();
  const raw = storage.getItem(KEYS.transaction);
  storage.removeItem(KEYS.transaction);
  if (!raw) throw new Error("Spotify sign-in expired. Start again.");
  const transaction = JSON.parse(raw) as OAuthTransaction;
  if (!returnedState || returnedState !== transaction.state)
    throw new Error("Spotify sign-in state did not match. Start again.");
  const callbackUrl = new URL(location.href);
  const registeredUrl = new URL(transaction.redirectUri);
  if (
    callbackUrl.origin !== registeredUrl.origin ||
    callbackUrl.pathname !== registeredUrl.pathname
  ) {
    throw new Error(
      "Spotify callback did not match the registered redirect URI.",
    );
  }
  history.replaceState({}, "", location.href.split("?")[0]);
  if (oauthError)
    throw new Error(`Spotify authorization failed: ${oauthError}.`);
  const tokens = await exchangeToken(
    new URLSearchParams({
      client_id: transaction.clientId,
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: transaction.redirectUri,
      code_verifier: transaction.verifier,
    }),
    fetcher,
  );
  storeTokens(tokens, storage);
  storage.setItem("music-explorer.spotify.client-id", transaction.clientId);
}

export function isConnected(storage: StorageLike = session()): boolean {
  return Boolean(storage.getItem(KEYS.access) && storage.getItem(KEYS.refresh));
}

export function disconnect(storage: StorageLike = session()): void {
  storage.removeItem(KEYS.access);
  storage.removeItem(KEYS.refresh);
  storage.removeItem(KEYS.expiry);
  storage.removeItem(KEYS.transaction);
  storage.removeItem("music-explorer.spotify.client-id");
}

export function expectedMatches(
  state: import("./types").PlaybackState | null,
  trackId: string,
  deviceId: string,
): boolean {
  return Boolean(
    state && state.trackId === trackId && state.deviceId === deviceId,
  );
}

export class SpotifyTokenProvider {
  private refreshInFlight: Promise<string> | null = null;
  constructor(
    private readonly storage: StorageLike = session(),
    private readonly fetcher: FetchLike = fetch,
  ) {}

  async accessToken(forceRefresh = false): Promise<string> {
    const access = this.storage.getItem(KEYS.access);
    const expiresAt = Number(this.storage.getItem(KEYS.expiry) ?? 0);
    if (!forceRefresh && access && Date.now() < expiresAt - 30_000)
      return access;
    if (this.refreshInFlight) return this.refreshInFlight;
    const refresh = this.storage.getItem(KEYS.refresh);
    if (!refresh) throw new Error("Spotify is disconnected. Sign in again.");
    this.refreshInFlight = (async () => {
      const response = await exchangeToken(
        new URLSearchParams({
          client_id: this.clientId,
          grant_type: "refresh_token",
          refresh_token: refresh,
        }),
        this.fetcher,
      );
      storeTokens(response, this.storage);
      return response.access_token;
    })();
    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  refreshAfterUnauthorized(rejectedToken: string): Promise<string> {
    const current = this.storage.getItem(KEYS.access);
    return current && current !== rejectedToken
      ? Promise.resolve(current)
      : this.accessToken(true);
  }

  private get clientId(): string {
    const value = this.storage.getItem("music-explorer.spotify.client-id");
    if (!value) throw new Error("Spotify client ID is missing. Sign in again.");
    return value;
  }
}
