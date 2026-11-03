import type { Paginated, StoreOrder } from "../../front-end/src/services/api";

export const order: StoreOrder = {
  id: "order-a", orderNumber: "PED-A", status: "READY", customer: { id: "client-a", name: "Ana", phone: "1111" },
  store: { id: "store-a", name: "Loja Central", whatsapp: "5592999999999" },
  addressSnapshot: { street: "Rua A", number: "10", city: "Manaus" },
  items: [{ id: "item-a", name: "Tijolo", sku: null, quantity: 2, unitPrice: "10.00", lineTotal: "20.00" }],
  subtotal: "20.00", discount: "0.00", total: "20.00", createdAt: "2026-10-20T12:00:00Z",
  delivery: { id: "delivery-a", status: "PREPARING", trackingCode: "TRACK-1", carrier: "Entrega local", estimatedDate: "2026-10-21T23:59:59Z", deliveredAt: null },
  isDelayed: true,
  timeline: [{ id: "event-a", kind: "ORDER", fromStatus: null, toStatus: "READY", actorId: "owner-a", note: "Separação concluída", createdAt: "2026-10-20T12:00:00Z" }],
  allowedActions: { orderStatuses: ["CANCELED"], deliveryStatuses: ["IN_TRANSIT", "CANCELED"], canEditDelivery: true },
};
export const orderPage = (items: StoreOrder[] = [order], page = 1, total = items.length): Paginated<StoreOrder> => ({ items, total, page, limit: 10 });
