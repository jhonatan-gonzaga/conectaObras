import type { DeliveryStatus, StoreOrderStatus } from "./api";

export const orderLabels: Record<StoreOrderStatus, string> = {
  PENDING: "Pendente", CONFIRMED: "Confirmado", PREPARING: "Em separação",
  READY: "Pronto", COMPLETED: "Concluído", CANCELED: "Cancelado",
};
export const deliveryLabels: Record<DeliveryStatus, string> = {
  PENDING: "Pendente", PREPARING: "Em preparo", IN_TRANSIT: "Em trânsito",
  DELIVERED: "Entregue", FAILED: "Falha na entrega", CANCELED: "Cancelada",
};

export function localDay(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseOrderDay(value: string, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a data no formato AAAA-MM-DD.");
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  if (Number.isNaN(date.getTime()) || localDay(date.toISOString()) !== value) throw new Error("Informe uma data válida.");
  return date.toISOString();
}

export function orderPeriod(from: string, to: string) {
  const period = { from: from ? parseOrderDay(from) : undefined, to: to ? parseOrderDay(to, true) : undefined };
  if (period.from && period.to && period.from > period.to) throw new Error("A data inicial deve ser anterior ou igual à data final.");
  return period;
}

export function orderDate(value?: string | null) {
  if (!value) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export const orderTimezone = () => `Horários no fuso do aparelho (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`;
