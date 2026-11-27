import type { ProductCategory } from "./store-products";

export type CatalogPage<T> = { items: T[]; total: number; page: number; limit: number };
export type CatalogDomain = "professionals" | "stores" | "products";
export type PublicAddress = {
  street: string | null; number: string | null; neighborhood: string | null; city: string | null; state: string | null;
  zipCode: string | null; complement: string | null; latitude: string | null; longitude: string | null;
};
export type PublicStoreSummary = {
  id: string; name: string | null; logoUrl: string | null; backgroundUrl: string | null; address: PublicAddress | null;
};
export const weekDays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
export const weekDayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
export type PublicOpeningHour = { dayOfWeek: typeof weekDays[number]; openingTime: string | null; closingTime: string | null; closed: boolean };
export type PublicPromotion = {
  id: string; promotionalPrice: string | null; discountPercent: string | null; startAt: string; endAt: string;
};
export type StorePromotion = PublicPromotion & { productId: string; productName: string; effectivePrice: string };
export type PublicStore = PublicStoreSummary & {
  description: string | null; coverUrl: string | null; phone: string | null; whatsapp: string | null;
  openingHours: PublicOpeningHour[]; timeZone: string; openNow: boolean;
};
export type PublicStoreDetail = PublicStore & { promotions: StorePromotion[] };
export type PublicProduct = {
  id: string; name: string; description: string | null; basePrice: string; effectivePrice: string;
  images: { url: string; altText: string | null; isCover: boolean }[]; coverUrl: string | null;
  store: PublicStoreSummary; category: ProductCategory; stock: number; inStock: boolean;
  onPromotion: boolean; promotion: PublicPromotion | null;
};
export type StoreQuery = { q?: string; city?: string; neighborhood?: string; openNow?: boolean; page?: number; limit?: number };
export type ProductQuery = {
  q?: string; storeId?: string; categoryId?: string; minPrice?: string; maxPrice?: string;
  inStock?: boolean; onPromotion?: boolean; page?: number; limit?: number;
};

// Format the API's decimal strings without converting monetary values to floats.
export function formatCatalogPrice(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return "Preço indisponível";
  const whole = match[1].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${whole},${(match[2] ?? "").padEnd(2, "0")}`;
}

export function catalogPriceInput(value: string): string | undefined {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  return /^\d{1,8}(\.\d{1,2})?$/.test(normalized) ? normalized : undefined;
}

export function catalogPriceError(min: string, max: string): string | null {
  const lower = catalogPriceInput(min);
  const upper = catalogPriceInput(max);
  if ((min.trim() && lower === undefined) || (max.trim() && upper === undefined)) return "Informe preços não negativos com até duas casas decimais.";
  if (lower !== undefined && upper !== undefined && Number(lower) > Number(upper)) return "O preço mínimo não pode superar o máximo.";
  return null;
}

export function formatPublicAddress(address: PublicAddress | null) {
  if (!address) return "Endereço não informado";
  return [[address.street, address.number].filter(Boolean).join(", "), address.neighborhood,
    [address.city, address.state].filter(Boolean).join(" - ")].filter(Boolean).join(" • ") || "Endereço não informado";
}
