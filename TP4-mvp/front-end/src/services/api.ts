import { authApi } from "./api-auth";
import { storeApi } from "./api-store";
import { servicesApi } from "./api-services";
import { supportApi } from "./api-support";
import { uploadApi } from "./api-uploads";

export { ApiError, setAccessToken, restoreAccessToken, resolveImageUrl } from "./api-core";
export type * from "./api-types";

export const api = {
  ...authApi,
  ...storeApi,
  ...uploadApi,
  ...servicesApi,
  ...supportApi,
};

export function formatMoney(value?: string | number | null) {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "A combinar";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "A combinar";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
