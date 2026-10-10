import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, resolveImageUrl } from "../front-end/src/services/api";
import { pickStoreImage } from "../front-end/src/services/store-logo";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn() }));
jest.mock("expo-image-picker", () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
describe("store image selection", () => {
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
  it.each(["cover", "background"] as const)("selects %s before creating a store, with the matching crop", async (kind) => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///image.png", mimeType: "image/png", fileSize: 1000 }] });
    const upload = jest.spyOn(api, "uploadStoreImage");
    expect(await pickStoreImage(kind)).toEqual({ uri: "file:///image.png", name: `store-${kind}.png`, type: "image/png" });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: kind === "cover" || Platform.OS === "android", aspect: kind === "background" ? [3, 1] : [1, 1] }));
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
  it("preserves the browser File for multipart upload", async () => {
    const file = { size: 1000 };
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "blob:image", fileName: "original.png", mimeType: "image/png", file }] });
    expect(await pickStoreImage("cover")).toEqual({ uri: "blob:image", name: "store-cover.png", type: "image/png", file });
  });
  it("handles cancellation and picker errors", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true }).mockRejectedValueOnce(new Error("Galeria indisponível"));
    expect(await pickStoreImage("cover")).toBeNull();
    await expect(pickStoreImage("background")).rejects.toThrow("Galeria indisponível");
  });
  it.each([["image/gif", 100, "JPG ou PNG"], ["image/png", 6 * 1024 * 1024, "5 MB"]])("rejects invalid files (%s)", async (mimeType, fileSize, message) => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///image", mimeType, fileSize }] });
    await expect(pickStoreImage("cover")).rejects.toThrow(message);
  });
  it("uses the configured API origin for local uploads and preserves remote/picker sources", () => {
    const origin = new URL(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api").origin;
    expect(resolveImageUrl("http://localhost:9876/uploads/images/a.png")).toBe(`${origin}/uploads/images/a.png`);
    expect(resolveImageUrl("/uploads/images/a.png")).toBe(`${origin}/uploads/images/a.png`);
    expect(resolveImageUrl("https://example.com/image.png")).toBe("https://example.com/image.png");
    expect(resolveImageUrl("file:///image.png")).toBe("file:///image.png");
    expect(resolveImageUrl("blob:image")).toBe("blob:image");
  });
});
