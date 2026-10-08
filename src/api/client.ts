import type { ProblemDetail, TokenPair } from './types';

const ACCESS_KEY = 'et.accessToken';
const REFRESH_KEY = 'et.refreshToken';

const OFFLINE_MESSAGE = "Can't connect to the server. Check your internet connection and try again.";
const SERVER_MESSAGE = 'The server is having trouble right now. Please try again in a moment.';

/**
 * What to show the user. Server-side failures (5xx, which is also what the dev proxy answers when the API is down)
 * never show raw status codes or internals; client errors keep the API's own explanation when there is one.
 */
function friendlyMessage(status: number, problem: ProblemDetail | null): string {
  if (status === 0) return OFFLINE_MESSAGE;
  if (status >= 500) return SERVER_MESSAGE;
  const detail = problem?.detail || problem?.title;
  if (detail) return detail;
  switch (status) {
    case 401:
      return 'Please log in to continue.';
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: ProblemDetail | null,
  ) {
    super(friendlyMessage(status, problem));
  }
}

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(pair: { accessToken: string; refreshToken?: string }) {
    localStorage.setItem(ACCESS_KEY, pair.accessToken);
    if (pair.refreshToken) localStorage.setItem(REFRESH_KEY, pair.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Called when a refresh fails, so the auth context can drop the user. */
let onSessionExpired: () => void = () => {};
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

// Share a single in-flight refresh between concurrent 401s.
let refreshInFlight: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return Promise.resolve(false);
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as Pick<TokenPair, 'accessToken'>;
      tokenStore.set({ accessToken: body.accessToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type Query = Record<string, string | number | undefined | null>;

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** Return the raw Response (e.g. for binary downloads). */
  raw?: boolean;
}

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  }
  const qs = params.toString();
  return `/api/v1${path}${qs ? `?${qs}` : ''}`;
}

function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  // FormData (file uploads) lets the browser set the multipart boundary itself.
  const isForm = opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = tokenStore.access;
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: isForm
      ? (opts.body as FormData)
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : undefined,
  }).catch(() => {
    // fetch only rejects when the request never got an answer (offline, server down, blocked).
    throw new ApiError(0, null);
  });
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts);

  if (res.status === 401 && tokenStore.refresh) {
    if (await refreshAccessToken()) {
      res = await send(path, opts);
    } else {
      tokenStore.clear();
      onSessionExpired();
    }
  }

  if (!res.ok) {
    let problem: ProblemDetail | null = null;
    try {
      problem = await res.json();
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, problem);
  }

  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return OFFLINE_MESSAGE; // a fetch made outside api()
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
