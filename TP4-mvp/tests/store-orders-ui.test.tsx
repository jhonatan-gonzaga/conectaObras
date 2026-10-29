import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { api, type StoreOrder } from "../front-end/src/services/api";
import { StoreOrdersScreen } from "../front-end/src/pages/lojista/StoreOrdersScreen";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

const order: StoreOrder = {
  id: "order-a", orderNumber: "PED-A", status: "READY", customer: { id: "client-a", name: "Ana", phone: "1111" },
  addressSnapshot: { street: "Rua A", number: "10", city: "Manaus" },
  items: [{ id: "item-a", name: "Tijolo", sku: null, quantity: 2, unitPrice: "10.00", lineTotal: "20.00" }],
  subtotal: "20.00", discount: "0.00", total: "20.00", createdAt: "2026-10-20T12:00:00Z",
  delivery: { id: "delivery-a", status: "PREPARING", trackingCode: null, carrier: null, estimatedDate: "2026-10-21T23:59:59Z", deliveredAt: null },
  isDelayed: true, timeline: [{ id: "event-a", kind: "ORDER", fromStatus: null, toStatus: "READY", actorId: "owner-a", note: null, createdAt: "2026-10-20T12:00:00Z" }],
  allowedActions: { orderStatuses: ["CANCELED"], deliveryStatuses: ["IN_TRANSIT", "CANCELED"], canEditDelivery: true },
};

describe("painel de pedidos da loja", () => {
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it("mostra atraso, detalhes e permite atualizar o rastreio", async () => {
    jest.spyOn(api, "storeOrders").mockResolvedValue([order]);
    jest.spyOn(api, "storeOrder").mockResolvedValue(order);
    const changeStatus = jest.spyOn(api, "changeStoreOrderDeliveryStatus").mockResolvedValue({ ...order, delivery: { ...order.delivery!, status: "IN_TRANSIT" } });
    const screen = render(<StoreOrdersScreen onBack={jest.fn()} />);
    fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
    expect(await screen.findByText("Cliente: Ana · 1111")).toBeTruthy();
    expect(screen.getByText(/Endereço: Rua A, 10, Manaus/)).toBeTruthy();
    expect(screen.getByText(/Entrega: Em preparo · Atrasada/)).toBeTruthy();
    fireEvent.press(screen.getByText("Em trânsito"));
    await waitFor(() => expect(changeStatus).toHaveBeenCalledWith("order-a", "IN_TRANSIT"));
  });

  it("atualiza automaticamente a lista por polling", async () => {
    jest.useFakeTimers();
    const list = jest.spyOn(api, "storeOrders").mockResolvedValue([order]);
    const screen = render(<StoreOrdersScreen onBack={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByLabelText("Abrir pedido PED-A")).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(15000); });
    expect(list).toHaveBeenCalledTimes(2);
    screen.unmount();
  });

  it("mantém cabeçalho e guia Pedidos ativa na lista e no detalhe", async () => {
    jest.spyOn(api, "storeOrders").mockResolvedValue([order]);
    jest.spyOn(api, "storeOrder").mockResolvedValue(order);
    const onProducts = jest.fn();
    const onPromotions = jest.fn();
    const onSwitchProfile = jest.fn();
    const onOpenProfile = jest.fn();
    const screen = render(<StoreOrdersScreen onBack={jest.fn()} onProducts={onProducts} onPromotions={onPromotions} onSwitchProfile={onSwitchProfile} onOpenProfile={onOpenProfile} />);
    expect(screen.getByLabelText("Conecta Obras Itacoatiara")).toBeTruthy();
    expect(screen.getByLabelText("Pedidos").props.accessibilityState.selected).toBe(true);
    fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
    expect(await screen.findByText("Pedido PED-A")).toBeTruthy();
    expect(screen.getByLabelText("Pedidos").props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText("Pedidos"));
    expect(await screen.findByLabelText("Abrir pedido PED-A")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Produtos"));
    fireEvent.press(screen.getByLabelText("Promoções"));
    fireEvent.press(screen.getByLabelText("Trocar perfil"));
    fireEvent.press(screen.getByLabelText("Abrir informações do perfil"));
    expect(onProducts).toHaveBeenCalledTimes(1);
    expect(onPromotions).toHaveBeenCalledTimes(1);
    expect(onSwitchProfile).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });
});
