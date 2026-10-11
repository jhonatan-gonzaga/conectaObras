export function resolveApiUrl(
  configuredUrl: string | undefined,
  platform: string,
  expoHostUri?: string,
  webHostname?: string,
): string {
  const configured = configuredUrl?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = platform === "web" ? webHostname : expoHostUri;
  if (host) {
    try {
      const hostname = new URL(host.includes("://") ? host : `http://${host}`).hostname;
      if (hostname) return `http://${hostname}:3000/api`;
    } catch {
      // Use the local development fallback if Expo did not provide a valid host.
    }
  }

  return `http://${platform === "android" ? "10.0.2.2" : "localhost"}:3000/api`;
}
