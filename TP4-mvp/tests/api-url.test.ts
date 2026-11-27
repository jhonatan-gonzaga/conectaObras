import { resolveApiUrl } from "../front-end/src/services/api-url";

describe("development API URL", () => {
  it("uses the Expo host for a phone on the same network", () => {
    expect(resolveApiUrl(undefined, "android", "10.82.10.175:8081")).toBe("http://10.82.10.175:3000/api");
  });

  it("uses the browser host for the web app", () => {
    expect(resolveApiUrl(undefined, "web", undefined, "localhost")).toBe("http://localhost:3000/api");
  });

  it("honors an explicit address and strips its trailing slash", () => {
    expect(resolveApiUrl("http://api.example:4000/api/", "android", "10.82.10.175:8081")).toBe("http://api.example:4000/api");
  });

  it("uses the Android emulator address without an Expo host", () => {
    expect(resolveApiUrl(undefined, "android")).toBe("http://10.0.2.2:3000/api");
  });
});
