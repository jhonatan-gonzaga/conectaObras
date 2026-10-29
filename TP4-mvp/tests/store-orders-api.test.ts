import { ApiError, api } from "../front-end/src/services/api";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
afterEach(() => jest.restoreAllMocks());

it("envia filtros e paginação para as rotas corretas de cada perfil", async () => {
  const request = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ items: [], total: 0, page: 2, limit: 10 }) } as Response);
  await api.storeOrdersPage({ status: "READY", from: "2026-10-01T00:00:00Z", page: 2, limit: 10 });
  await api.clientStoreOrders({ group: "OPEN", page: 2, limit: 10 });
  await api.clientStoreOrder("id/unsafe");
  expect(request.mock.calls[0][0]).toContain("/store-orders?status=READY&from=2026-10-01T00%3A00%3A00Z&page=2&limit=10");
  expect(request.mock.calls[1][0]).toContain("/orders?group=OPEN&page=2&limit=10");
  expect(request.mock.calls[2][0]).toContain("/orders/id%2Funsafe");
});

it("envia somente o status ou dados de rastreio esperados e preserva o 409", async () => {
  const request = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "{}" } as Response);
  await api.changeStoreOrderStatus("o", "CONFIRMED");
  await api.changeStoreOrderDeliveryStatus("o", "IN_TRANSIT");
  await api.upsertStoreOrderDelivery("o", { trackingCode: "ABC", carrier: "Local", estimatedDate: "2026-11-01T03:59:59.999Z" });
  expect(request.mock.calls[0][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }) });
  expect(request.mock.calls[1][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ status: "IN_TRANSIT" }) });
  expect(request.mock.calls[2][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ trackingCode: "ABC", carrier: "Local", estimatedDate: "2026-11-01T03:59:59.999Z" }) });
  request.mockResolvedValueOnce({ ok: false, status: 409, text: async () => JSON.stringify({ message: "O pedido mudou." }) } as Response);
  await expect(api.changeStoreOrderStatus("o", "READY")).rejects.toMatchObject({ status: 409, message: "O pedido mudou." } as Partial<ApiError>);
});
