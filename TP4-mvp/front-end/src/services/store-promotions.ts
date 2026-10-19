import type { StoreProduct } from "./store-products";

export type DiscountType = "PERCENTAGE" | "FIXED" | "DIRECT";
export type PromotionStatus = "DRAFT" | "ACTIVE" | "ENDED" | "CANCELED";
export type PromotionState = PromotionStatus | "SCHEDULED";
export type PromotionProduct = Pick<StoreProduct, "id" | "name" | "price" | "sku" | "stock" | "status" | "images">;
export type StorePromotion = {
  id: string; name: string; productId: string | null; product: PromotionProduct | null;
  discountType: DiscountType; discountValue: string; discountPct: string;
  status: PromotionStatus; startsAt: string | null; endsAt: string | null;
};
export type PromotionForm = {
  name: string; productId: string; discountType: DiscountType; discountValue: string;
  startsAt: string; endsAt: string;
};
export type PromotionPayload = Omit<PromotionForm, "discountValue"> & { discountValue: number; status: "DRAFT" | "ACTIVE" };
export const PROMOTION_TIMEZONE = "Horário de Brasília (BRT · UTC−3)";
export const promotionLabels: Record<PromotionState, string> = {
  ACTIVE: "Vigentes", SCHEDULED: "Agendadas", ENDED: "Expiradas", DRAFT: "Rascunhos", CANCELED: "Inativas",
};

// These wall-clock values always refer to Brasília, independent of the device timezone.
export function toBrasiliaInput(iso: string | null) {
  return iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 16) : "";
}
export function fromBrasiliaInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-03:00`);
  if (!Number.isFinite(date.getTime()) || toBrasiliaInput(date.toISOString()) !== value) return null;
  return date.toISOString();
}
export function promotionDate(iso: string | null) {
  const value = toBrasiliaInput(iso);
  if (!value) return "Sem limite";
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} às ${value.slice(11)} (BRT)`;
}
export function emptyPromotionForm(): PromotionForm {
  const now = new Date();
  return { name: "", productId: "", discountType: "PERCENTAGE", discountValue: "", startsAt: toBrasiliaInput(now.toISOString()), endsAt: toBrasiliaInput(new Date(now.getTime() + 7 * 86400000).toISOString()) };
}
export function promotionToForm(promotion: StorePromotion): PromotionForm {
  return { name: promotion.name, productId: promotion.productId ?? "", discountType: promotion.discountType,
    discountValue: promotion.discountValue.replace(".", ","), startsAt: toBrasiliaInput(promotion.startsAt), endsAt: toBrasiliaInput(promotion.endsAt) };
}
export function promotionState(promotion: StorePromotion, now = Date.now()): PromotionState {
  if (promotion.endsAt && new Date(promotion.endsAt).getTime() <= now) return "ENDED";
  if (promotion.status !== "ACTIVE") return promotion.status;
  if (promotion.startsAt && new Date(promotion.startsAt).getTime() > now) return "SCHEDULED";
  return "ACTIVE";
}
export function promotionPreview(price: string, type: DiscountType, input: string) {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  const cents = Math.round(Number(price) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || value <= 0 || (type === "PERCENTAGE" && value >= 100)) return null;
  const basisPoints = Math.round(value * 100);
  const finalCents = type === "PERCENTAGE" ? Math.floor((cents * (10000 - basisPoints) + 5000) / 10000)
    : type === "FIXED" ? cents - Math.round(value * 100) : Math.round(value * 100);
  if (finalCents <= 0 || finalCents >= cents) return null;
  return { finalPrice: (finalCents / 100).toFixed(2), savings: ((cents - finalCents) / 100).toFixed(2), percent: Math.round((cents - finalCents) / cents * 100) };
}
export function validatePromotionForm(form: PromotionForm, product: PromotionProduct | undefined, promotions: StorePromotion[], status: "DRAFT" | "ACTIVE", id?: string, now = Date.now()) {
  const errors: string[] = [];
  if (!form.name.trim() || form.name.trim().length > 120) errors.push("Informe um nome de até 120 caracteres.");
  if (!product || product.id !== form.productId || product.status !== "ACTIVE") errors.push("Selecione um produto ativo da sua loja.");
  if (!product || !promotionPreview(product.price, form.discountType, form.discountValue)) errors.push("Informe um desconto válido. O preço final deve ser positivo e menor que o preço de tabela.");
  const start = fromBrasiliaInput(form.startsAt);
  const end = fromBrasiliaInput(form.endsAt);
  if (!start || !end || end <= start) errors.push("O término deve ser posterior ao início. Informe datas e horários válidos.");
  if (status === "ACTIVE" && end && new Date(end).getTime() <= now) errors.push("Atualize a vigência antes de publicar uma promoção expirada.");
  if (status === "ACTIVE" && start && end && promotions.some((p) => p.id !== id && p.productId === form.productId && p.status === "ACTIVE"
    && (!p.startsAt || p.startsAt < end) && (!p.endsAt || p.endsAt > start))) errors.push("Já existe uma promoção ativa ou agendada para este produto nesse período.");
  return errors;
}
export function promotionPayload(form: PromotionForm, status: "DRAFT" | "ACTIVE"): PromotionPayload {
  return { ...form, name: form.name.trim(), discountValue: Number(form.discountValue.replace(",", ".")), startsAt: fromBrasiliaInput(form.startsAt)!, endsAt: fromBrasiliaInput(form.endsAt)!, status };
}
