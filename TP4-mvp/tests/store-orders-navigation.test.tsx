import { useEffect } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { RootNavigator } from "../front-end/src/navigation/RootNavigator";
import { useAppNavigation } from "../front-end/src/navigation/useAppNavigation";
import { api, type StoreOrder } from "../front-end/src/services/api";
import { emptyStoreForm } from "../front-end/src/services/store-form";
import { order, orderPage } from "./fixtures/store-order";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/services/image-upload", () => ({ pickProductImage: jest.fn(), pickAvatarImage: jest.fn() }));
jest.mock("../front-end/src/services/store-logo", () => ({ pickStoreImage: jest.fn() }));
jest.mock("expo-audio", () => ({}));
jest.mock("../front-end/src/components/native-date-time-field", () => {
  const React = require("react"); const { TextInput } = require("react-native");
  return { NativeDateTimeField: ({ label, value, onChange, disabled }: any) => React.createElement(TextInput, { accessibilityLabel: label, value, editable: !disabled, onChangeText: onChange }) };
});

function Flow() {
  const navigation = useAppNavigation();
  useEffect(() => { void navigation.authenticate(); }, []);
  if (navigation.screen === "accountProfile") return <Pressable onPress={() => navigation.setScreen(navigation.profileReturnScreen)}><Text>Voltar da conta</Text></Pressable>;
  return <RootNavigator navigation={navigation} isDarkMode={false} onToggleDarkMode={jest.fn()} />;
}
beforeEach(() => {
  jest.spyOn(api, "myServiceAdsSummary").mockResolvedValue({ receivedApplications: 0 } as never);
  jest.spyOn(api, "unreadConversations").mockResolvedValue({ count: 0 });
});
afterEach(() => jest.restoreAllMocks());

it("abre acompanhamento pelo início do cliente, volta à lista pelo cabeçalho e retorna do perfil", async () => {
  jest.spyOn(api, "me").mockResolvedValue({ id: "client-a", role: "CLIENTE" } as never);
  jest.spyOn(api, "categories").mockResolvedValue([]);
  jest.spyOn(api, "professionals").mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  jest.spyOn(api, "clientStoreOrders").mockResolvedValue(orderPage());
  jest.spyOn(api, "clientStoreOrder").mockResolvedValue(order);
  const screen = render(<Flow />);
  await screen.findByText("O que você precisa hoje?");
  fireEvent.press(screen.getByLabelText("Pedidos"));
  fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
  await screen.findByText("Pedido PED-A");
  fireEvent.press(screen.getByLabelText("Voltar"));
  await screen.findByLabelText("Abrir pedido PED-A");
  fireEvent.press(screen.getByLabelText("Abrir perfil"));
  fireEvent.press(await screen.findByText("Voltar da conta"));
  await screen.findByText("Meus Pedidos");
  fireEvent.press(screen.getByLabelText("Voltar"));
  expect(await screen.findByText("O que você precisa hoje?")).toBeTruthy();
});

it("propaga a transição à lista e recarrega os indicadores ao voltar ao dashboard do lojista", async () => {
  jest.spyOn(api, "me").mockResolvedValue({ id: "owner-a", role: "LOJISTA", name: "Ana" } as never);
  const store = emptyStoreForm();
  Object.assign(store, { id: "store-a", status: "ACTIVE", name: "Loja Central", cnpj: "11222333000181", phone: "92999999999" });
  Object.assign(store.address, { street: "Rua A", number: "10", neighborhood: "Centro", city: "Manaus", state: "AM", zipCode: "69000000" });
  store.openingHours[0] = { dayOfWeek: "MONDAY", closed: false, openingTime: "08:00", closingTime: "18:00" };
  jest.spyOn(api, "myStore").mockResolvedValue(store as never);
  jest.spyOn(api, "storeIdentity").mockResolvedValue({ name: "Loja Central", status: "ACTIVE" });
  let current: StoreOrder = { ...order, status: "PENDING", delivery: null, isDelayed: false, allowedActions: { orderStatuses: ["CONFIRMED", "CANCELED"], deliveryStatuses: [], canEditDelivery: false } };
  const dashboard = jest.spyOn(api, "storeDashboard").mockImplementation(async () => ({ hasStore: true, activeProducts: 1, lowStockProducts: 0, activePromotions: 0, unreadMessages: 0, ordersByStatus: { PENDING: current.status === "PENDING" ? 1 : 0, CONFIRMED: current.status === "CONFIRMED" ? 1 : 0 } }));
  jest.spyOn(api, "storeOrdersPage").mockImplementation(async (filters) => orderPage(!filters?.status || current.status === filters.status ? [current] : []));
  jest.spyOn(api, "storeOrder").mockImplementation(async () => current);
  jest.spyOn(api, "changeStoreOrderStatus").mockImplementation(async () => {
    current = { ...current, status: "CONFIRMED", allowedActions: { orderStatuses: ["PREPARING", "CANCELED"], deliveryStatuses: [], canEditDelivery: true } };
    return current;
  });
  const screen = render(<Flow />);
  fireEvent.press(await screen.findByLabelText("Pendentes: 1"));
  fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
  fireEvent.press(await screen.findByLabelText("Pedido: Confirmado"));
  fireEvent.press(screen.getByLabelText("Confirmar"));
  await screen.findByText("Pedido atualizado com sucesso.");
  fireEvent.press(screen.getByLabelText("Voltar à lista de pedidos"));
  expect(await screen.findByText("Nenhum pedido encontrado com esses filtros.")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Painel"));
  expect(await screen.findByLabelText("Pendentes: 0")).toBeTruthy();
  expect(screen.getByLabelText("Confirmados: 1")).toBeTruthy();
  expect(dashboard).toHaveBeenCalledTimes(2);
});
