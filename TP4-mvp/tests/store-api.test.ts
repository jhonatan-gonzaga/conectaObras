import { Platform } from "react-native";
import { File } from "expo-file-system";
import { ApiError, api } from "../front-end/src/services/api";
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { hostUri: "localhost:8081" } } }));
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation((uri: string) => ({ uri, name: "image.png", type: "image/png", bytes: async () => new Uint8Array() })) }));
describe("store API errors", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  it.each(["cover", "background"] as const)("sends %s as multipart to the JWT-owned route without forcing Content-Type", async (kind) => {
    const append = jest.spyOn(FormData.prototype, "append");
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 201, text: async () => JSON.stringify({ id: "s1", status: "DRAFT" }) } as Response);
    await api.uploadStoreImage(kind, { uri: "file:///image.png", name: "image.png", type: "image/png" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain(`/stores/me/${kind}`);
    expect(options?.body).toBeInstanceOf(FormData);
    expect(options?.headers).not.toHaveProperty("Content-Type");
    expect(File).toHaveBeenCalledWith("file:///image.png");
    expect(append).toHaveBeenCalledWith("file", expect.objectContaining({ bytes: expect.any(Function) }));
  });
  it("preserves the browser blob in multipart", async () => {
    jest.replaceProperty(Platform, "OS", "web");
    const append = jest.spyOn(FormData.prototype, "append");
    const blob = new Blob(["image"], { type: "image/png" });
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 201, text: async () => JSON.stringify({ id: "s1", status: "DRAFT" }) } as Response);
    await api.uploadStoreImage("background", { uri: "blob:image", name: "image.png", type: "image/png", file: blob });
    expect(append).toHaveBeenCalledWith("file", blob, "image.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("preserves server activation pending codes", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 400, text: async () => JSON.stringify({ message: "Cadastro incompleto", pending: ["CNPJ_INVALID"] }) } as Response);
    let caught: unknown;
    try { await api.changeMyStoreStatus("ACTIVE"); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ status: 400, details: { pending: ["CNPJ_INVALID"] } });
  });
});
