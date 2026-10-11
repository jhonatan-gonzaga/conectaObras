import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

export type StoreImageKind = "cover" | "background";
export type StoreImageFile = { uri: string; name: string; type: string; file?: Blob };

export async function pickStoreImage(kind: StoreImageKind): Promise<StoreImageFile | null> {
  // The system image picker grants access to the selected file. Launch directly
  // from the tap so browsers retain the user gesture required to open the dialog.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], quality: 0.85, allowsEditing: kind === "cover" || Platform.OS === "android",
    aspect: kind === "background" ? [3, 1] : [1, 1],
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const uriExtension = asset.uri.split("?")[0].toLowerCase().endsWith(".png") ? "image/png" : undefined;
  const type = asset.mimeType ?? uriExtension ?? "image/jpeg";
  if (!["image/jpeg", "image/png"].includes(type)) throw new Error("Escolha uma imagem JPG ou PNG.");
  const size = asset.fileSize ?? asset.file?.size;
  if (size && size > 5 * 1024 * 1024) throw new Error("A imagem deve ter até 5 MB.");
  const name = `store-${kind}.${type === "image/png" ? "png" : "jpg"}`;
  return { uri: asset.uri, name, type, ...(asset.file ? { file: asset.file } : {}) };
}
