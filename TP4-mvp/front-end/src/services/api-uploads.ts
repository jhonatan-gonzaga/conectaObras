import { File } from "expo-file-system";
import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import type { StoreProfile } from "./store-form";
import type { ProductImage } from "./store-products";
import { API_URL, ApiError, getAccessToken, request } from "./api-core";

export async function uploadStoreImage(kind: "cover" | "background", file: { uri: string; name: string; type: string; file?: Blob }) {
  const data = new FormData();
  if (Platform.OS === "web") {
    const blob = file.file ?? await fetch(file.uri).then((response) => response.blob());
    if (!blob) throw new ApiError("Não foi possível ler a imagem selecionada.", 0);
    data.append("file", blob, file.name);
  } else data.append("file", new File(file.uri));
  return request<StoreProfile>(`/stores/me/${kind}`, { method: "POST", body: data });
}

export function uploadStoreProductImage(id: string, asset: ImagePickerAsset, onProgress: (percent: number) => void): Promise<ProductImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    const name = asset.fileName || asset.uri.split("/").pop() || "produto.jpg";
    const type = asset.mimeType || (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    if (asset.file) form.append("file", asset.file, name);
    else form.append("file", { uri: asset.uri, name, type } as unknown as Blob);
    xhr.open("POST", `${API_URL}/store-products/${encodeURIComponent(id)}/images`);
    const accessToken = getAccessToken();
    if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.round(event.loaded * 100 / event.total));
    };
    xhr.onerror = () => reject(new ApiError("Nao foi possivel enviar a foto.", 0));
    xhr.onabort = () => reject(new ApiError("Envio da foto cancelado.", 0));
    xhr.onload = () => {
      let data: unknown;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; }
      catch { reject(new ApiError("Resposta invalida ao enviar a foto.", xhr.status)); return; }
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = data as { message?: string | string[] } | null;
        reject(new ApiError(Array.isArray(error?.message) ? error.message.join("\n") : error?.message || "Falha ao enviar a foto.", xhr.status));
        return;
      }
      onProgress(100);
      resolve(data as ProductImage);
    };
    onProgress(0);
    xhr.send(form);
  });
}
