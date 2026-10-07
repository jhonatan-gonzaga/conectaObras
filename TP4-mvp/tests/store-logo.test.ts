import * as ImagePicker from "expo-image-picker";
import { api } from "../front-end/src/services/api";
import { pickStoreLogo } from "../front-end/src/services/store-logo";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn() }));
jest.mock("expo-image-picker", () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
describe("store logo upload", () => {
  beforeEach(() => (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true }));
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
  it("uploads to the owner-scoped endpoint and returns the saved store", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///logo.png", fileName: "logo.png", mimeType: "image/png", fileSize: 1000 }] });
    const upload = jest.spyOn(api, "uploadStoreLogo").mockResolvedValue({ id: "s1", name: "Loja", status: "DRAFT", logoUrl: "https://example.com/logo.png" });
    expect((await pickStoreLogo())?.logoUrl).toBe("https://example.com/logo.png");
    expect(upload).toHaveBeenCalledWith({ uri: "file:///logo.png", name: "logo.png", type: "image/png" });
  });
  it("handles denied permission and cancellation", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await expect(pickStoreLogo()).rejects.toThrow("galeria");
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    expect(await pickStoreLogo()).toBeNull();
  });
  it.each([["image/gif", 100, "JPG ou PNG"], ["image/png", 6 * 1024 * 1024, "5 MB"]])("rejects invalid files (%s)", async (mimeType, fileSize, message) => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///logo", mimeType, fileSize }] });
    const upload = jest.spyOn(api, "uploadStoreLogo");
    await expect(pickStoreLogo()).rejects.toThrow(message);
    expect(upload).not.toHaveBeenCalled();
  });
});
