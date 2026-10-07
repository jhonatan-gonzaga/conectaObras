import * as ImagePicker from "expo-image-picker";
import { api } from "./api";

export async function pickStoreLogo() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Permita o acesso à galeria para escolher o logo.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const name = asset.fileName ?? asset.uri.split("/").pop() ?? "logo.jpg";
  const type = asset.mimeType ?? (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  if (!["image/jpeg", "image/png"].includes(type)) throw new Error("Escolha um logo JPG ou PNG.");
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) throw new Error("O logo deve ter até 5 MB.");
  return api.uploadStoreLogo({ uri: asset.uri, name, type });
}
