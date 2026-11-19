import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiUrl } from "./api-url";

export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Platform.OS,
  Constants.expoConfig?.hostUri,
  typeof window !== "undefined" ? window.location?.hostname : undefined,
);

let accessToken: string | null = null;

export function getAccessToken() { return accessToken; }

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: { pending?: string[]; message?: string | string[]; field?: string },
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError("Nao foi possivel conectar ao servidor.", 0);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join("\n")
      : data?.message || "A requisicao falhou.";
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export function toQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function setAccessToken(token: string | null) {
  accessToken = token;
  if (Platform.OS === "web") {
    try {
      if (token) globalThis.sessionStorage?.setItem("accessToken", token);
      else globalThis.sessionStorage?.removeItem("accessToken");
    } catch { /* Storage can be disabled by the browser. */ }
  } else if (token) await SecureStore.setItemAsync("accessToken", token).catch(() => undefined);
  else await SecureStore.deleteItemAsync("accessToken").catch(() => undefined);
}

export async function restoreAccessToken() {
  if (Platform.OS === "web") {
    try { accessToken = globalThis.sessionStorage?.getItem("accessToken") ?? null; }
    catch { accessToken = null; }
  } else accessToken = await SecureStore.getItemAsync("accessToken").catch(() => null);
  return accessToken;
}

// Local uploads must use the same reachable origin as the configured API.
// Preserve remote image providers and local picker URIs.
export function resolveImageUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const base = new URL(API_URL);
    const image = new URL(value, base.origin);
    if (image.pathname.startsWith("/uploads/") &&
        (value.startsWith("/") || image.hostname === "localhost" || image.hostname === "127.0.0.1" || image.origin === base.origin)) {
      return `${base.origin}${image.pathname}${image.search}`;
    }
  } catch { /* A picker URI or non-HTTP source does not need rewriting. */ }
  return value;
}
