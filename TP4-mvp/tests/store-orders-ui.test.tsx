import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AppState, Linking, RefreshControl } from "react-native";
import { ApiError, api, type StoreOrder, type StoreOrderStatus, type DeliveryStatus } from "../front-end/src/services/api";
import { StoreOrdersScreen } from "../front-end/src/pages/lojista/StoreOrdersScreen";
import { ClientOrdersScreen } from "../front-end/src/pages/cliente/ClientOrdersScreen";
import { order, orderPage } from "./fixtures/store-order";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/components/native-date-time-field", () => {
  const React = require("react"); const { TextInput } = require("react-native");
  return { NativeDateTimeField: ({ label, value, onChange, disabled }: any) => React.createElement(TextInput, { accessibilityLabel: label, value, editable: !disabled, onChangeText: onChange }) };
});

beforeEach(() => {
  jest.spyOn(api, "me").mockResolvedValue({ id: "actor-a", avatarUrl: null } as never);
  jest.spyOn(api, "myServiceAdsSummary").mockResolvedValue({ receivedApplications: 0 } as never);
  jest.spyOn(api, "unreadConversations").mockResolvedValue({ count: 0 });
  jest.spyOn(api, "storeOrdersPage").mockResolvedValue(orderPage());
  jest.spyOn(api, "storeOrder").mockResolvedValue(order);
  jest.spyOn(api, "clientStoreOrders").mockResolvedValue(orderPage());
  jest.spyOn(api, "clientStoreOrder").mockResolvedValue(order);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

async function openOrder() {
  const screen = render(<StoreOrdersScreen onBack={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
  await screen.findByText("Pedido PED-A");
  return screen;
}

it("mostra cliente, itens, valores, endereço, previsão, atraso e histórico reais", async () => {
  const screen = await openOrder();
  expect(screen.getByText("Cliente: Ana · 1111")).toBeTruthy();
  expect(screen.getByText("2× Tijolo")).toBeTruthy();
  expect(screen.getByText(/Subtotal: R\$\s*20,00/)).toBeTruthy();
  expect(screen.getByText(/Entrega em: Rua A, 10, Manaus/)).toBeTruthy();
  expect(screen.getByText("Entrega: Em preparo · Atrasada")).toBeTruthy();
  expect(screen.getByText("Separação concluída")).toBeTruthy();
  expect(screen.getByText("Rastreio: TRACK-1")).toBeTruthy();
  expect(screen.getAllByText(/fuso do aparelho/).length).toBeGreaterThan(0);
});

it("pagina na API e reinicia na primeira página ao mudar status ou período", async () => {
  jest.mocked(api.storeOrdersPage).mockImplementation(async (filters) => orderPage([order], filters?.page, 25));
  const screen = render(<StoreOrdersScreen onBack={jest.fn()} />);
  await screen.findByLabelText("Abrir pedido PED-A");
  fireEvent.press(screen.getByLabelText("Próxima página"));
  await waitFor(() => expect(api.storeOrdersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })));
  await screen.findByLabelText("Abrir pedido PED-A");
  fireEvent.press(screen.getByLabelText("Filtrar: Confirmado"));
  await waitFor(() => expect(api.storeOrdersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: "CONFIRMED" })));
  fireEvent.changeText(screen.getByLabelText("Data inicial"), "2026-10-01");
  fireEvent.changeText(screen.getByLabelText("Data final"), "2026-10-31");
  fireEvent.press(screen.getByLabelText("Aplicar período"));
  await waitFor(() => expect(api.storeOrdersPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, from: new Date("2026-10-01T00:00:00").toISOString(), to: new Date("2026-10-31T23:59:59.999").toISOString() })));
  fireEvent.press(screen.getByLabelText("Limpar período"));
  await waitFor(() => expect(api.storeOrdersPage).toHaveBeenLastCalledWith(expect.objectContaining({ from: undefined, to: undefined })));
});

it("rejeita período invertido e data inexistente antes da API", async () => {
  const screen = render(<StoreOrdersScreen onBack={jest.fn()} />);
  await screen.findByLabelText("Abrir pedido PED-A");
  fireEvent.changeText(screen.getByLabelText("Data inicial"), "2026-10-31");
  fireEvent.changeText(screen.getByLabelText("Data final"), "2026-10-01");
  fireEvent.press(screen.getByLabelText("Aplicar período"));
  expect(screen.getByText("A data inicial deve ser anterior ou igual à data final.")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Data inicial"), "2026-02-30");
  fireEvent.press(screen.getByLabelText("Aplicar período"));
  expect(screen.getByText("Informe uma data válida.")).toBeTruthy();
  expect(api.storeOrdersPage).toHaveBeenCalledTimes(1);
});

it("pede confirmação, permite desistir e bloqueia duplo toque durante a gravação", async () => {
  let finish!: (value: StoreOrder) => void;
  const change = jest.spyOn(api, "changeStoreOrderDeliveryStatus").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const screen = await openOrder();
  fireEvent.press(screen.getByLabelText("Entrega: Em trânsito"));
  expect(screen.getByText("Confirmar alteração")).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Manter como está"));
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Entrega: Em trânsito"));
  const confirm = screen.getByLabelText("Confirmar");
  fireEvent.press(confirm);
  fireEvent.press(confirm);
  fireEvent.press(screen.getByLabelText("Entrega: Em trânsito"));
  expect(change).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenCalledWith("order-a", "IN_TRANSIT");
  await act(async () => { finish(order); });
  await screen.findByText("Pedido atualizado com sucesso.");
});

it.each([
  ["PENDING", "CONFIRMED", "Confirmado"], ["PENDING", "CANCELED", "Cancelado"],
  ["CONFIRMED", "PREPARING", "Em separação"], ["CONFIRMED", "CANCELED", "Cancelado"],
  ["PREPARING", "READY", "Pronto"], ["PREPARING", "CANCELED", "Cancelado"],
  ["READY", "CANCELED", "Cancelado"], ["READY", "COMPLETED", "Concluído"],
] as [StoreOrderStatus, StoreOrderStatus, string][])("confirma transição de pedido %s → %s", async (from, to, label) => {
  const current = { ...order, status: from, allowedActions: { orderStatuses: [to], deliveryStatuses: [], canEditDelivery: false } };
  jest.mocked(api.storeOrder).mockResolvedValue(current);
  const change = jest.spyOn(api, "changeStoreOrderStatus").mockResolvedValue({ ...current, status: to });
  const screen = await openOrder();
  fireEvent.press(screen.getByLabelText(`Pedido: ${label}`));
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Confirmar"));
  await waitFor(() => expect(change).toHaveBeenCalledWith(order.id, to));
  await screen.findByText("Pedido atualizado com sucesso.");
});

it.each([
  ["PENDING", "PREPARING", "Em preparo"], ["PENDING", "CANCELED", "Cancelada"],
  ["PREPARING", "IN_TRANSIT", "Em trânsito"], ["PREPARING", "CANCELED", "Cancelada"],
  ["IN_TRANSIT", "DELIVERED", "Entregue"], ["IN_TRANSIT", "FAILED", "Falha na entrega"],
  ["FAILED", "IN_TRANSIT", "Em trânsito"], ["FAILED", "CANCELED", "Cancelada"],
] as [DeliveryStatus, DeliveryStatus, string][])("confirma transição de entrega %s → %s", async (from, to, label) => {
  const current = { ...order, delivery: { ...order.delivery!, status: from }, allowedActions: { orderStatuses: [], deliveryStatuses: [to], canEditDelivery: false } };
  jest.mocked(api.storeOrder).mockResolvedValue(current);
  const change = jest.spyOn(api, "changeStoreOrderDeliveryStatus").mockResolvedValue({ ...current, delivery: { ...current.delivery, status: to } });
  const screen = await openOrder();
  fireEvent.press(screen.getByLabelText(`Entrega: ${label}`));
  expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Confirmar"));
  await waitFor(() => expect(change).toHaveBeenCalledWith(order.id, to));
  await screen.findByText("Pedido atualizado com sucesso.");
});

it("salva rastreio e previsão validada no fim do dia local após confirmação", async () => {
  const save = jest.spyOn(api, "upsertStoreOrderDelivery").mockResolvedValue(order);
  const screen = await openOrder();
  fireEvent.changeText(screen.getByLabelText("Previsão de entrega"), "2026-02-30");
  fireEvent.press(screen.getByLabelText("Salvar entrega"));
  expect(screen.getByText("Informe uma data válida.")).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("Previsão de entrega"), "2026-11-15");
  fireEvent.changeText(screen.getByLabelText("Código de rastreio"), " NOVO-123 ");
  fireEvent.changeText(screen.getByLabelText("Transportadora"), " Local ");
  fireEvent.press(screen.getByLabelText("Salvar entrega"));
  expect(save).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Confirmar"));
  await waitFor(() => expect(save).toHaveBeenCalledWith(order.id, { trackingCode: "NOVO-123", carrier: "Local", estimatedDate: new Date("2026-11-15T23:59:59.999").toISOString() }));
  await screen.findByText("Pedido atualizado com sucesso.");
});

it("recarrega lista e detalhe no 409, substitui ações e remove atraso após entrega", async () => {
  const delivered = { ...order, status: "COMPLETED" as const, isDelayed: false, delivery: { ...order.delivery!, status: "DELIVERED" as const }, allowedActions: { orderStatuses: [], deliveryStatuses: [], canEditDelivery: false } };
  jest.spyOn(api, "changeStoreOrderDeliveryStatus").mockRejectedValue(new ApiError("Conflito", 409));
  const screen = await openOrder();
  jest.mocked(api.storeOrder).mockResolvedValue(delivered);
  jest.mocked(api.storeOrdersPage).mockResolvedValue(orderPage([delivered]));
  fireEvent.press(screen.getByLabelText("Entrega: Em trânsito"));
  fireEvent.press(screen.getByLabelText("Confirmar"));
  await screen.findByText(/O pedido mudou em outro acesso. O estado foi atualizado/);
  expect(screen.queryByLabelText("Entrega: Em trânsito")).toBeNull();
  expect(screen.queryByText("Entrega atrasada")).toBeNull();
  fireEvent.press(screen.getByLabelText("Voltar à lista de pedidos"));
  expect(await screen.findByText("Entregue")).toBeTruthy();
  expect(api.changeStoreOrderDeliveryStatus).toHaveBeenCalledTimes(1);
});

it("mantém ações bloqueadas se a recarga do 409 falhar até uma nova leitura bem-sucedida", async () => {
  jest.spyOn(api, "changeStoreOrderDeliveryStatus").mockRejectedValue(new ApiError("Conflito", 409));
  const screen = await openOrder();
  jest.mocked(api.storeOrder).mockRejectedValue(new ApiError("Indisponível", 503));
  fireEvent.press(screen.getByLabelText("Entrega: Em trânsito"));
  fireEvent.press(screen.getByLabelText("Confirmar"));
  await screen.findByText(/Atualize o estado antes de tentar novamente/);
  expect(screen.getByLabelText("Entrega: Em trânsito")).toBeDisabled();
  jest.mocked(api.storeOrder).mockResolvedValue(order);
  fireEvent.press(screen.getByLabelText("Tentar novamente"));
  await waitFor(() => expect(screen.getByLabelText("Entrega: Em trânsito").props.accessibilityState.disabled).toBe(false));
});

it("exibe erro da API e permite recarregar lista e detalhe", async () => {
  jest.mocked(api.storeOrdersPage).mockRejectedValueOnce(new ApiError("Serviço indisponível", 503));
  const screen = render(<StoreOrdersScreen onBack={jest.fn()} />);
  await screen.findByText("Serviço indisponível");
  fireEvent.press(screen.getByLabelText("Tentar novamente"));
  fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
  await screen.findByText("Pedido PED-A");
  const change = jest.spyOn(api, "changeStoreOrderStatus").mockRejectedValue(new ApiError("Falha na atualização", 503));
  fireEvent.press(screen.getByLabelText("Pedido: Cancelado"));
  fireEvent.press(screen.getByLabelText("Confirmar"));
  await screen.findByText("Falha na atualização");
  expect(change).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Pedido PED-A")).toBeTruthy();
});

it("ignora respostas de filtros antigos que chegam depois da consulta atual", async () => {
  let finish!: (value: ReturnType<typeof orderPage>) => void;
  jest.mocked(api.storeOrdersPage).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(orderPage([]));
  const screen = render(<StoreOrdersScreen onBack={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Filtrar: Confirmado"));
  await screen.findByText("Nenhum pedido encontrado com esses filtros.");
  await act(async () => { finish(orderPage()); });
  expect(screen.queryByLabelText("Abrir pedido PED-A")).toBeNull();
});

it("atualiza por polling, preserva o formulário editado, pausa no fundo e recarrega ao retornar", async () => {
  jest.useFakeTimers();
  let onState!: (state: string) => void;
  const remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => { onState = callback; return { remove }; });
  const screen = await openOrder();
  fireEvent.changeText(screen.getByLabelText("Código de rastreio"), "RASCUNHO");
  const before = jest.mocked(api.storeOrder).mock.calls.length;
  await act(async () => { jest.advanceTimersByTime(15000); });
  expect(api.storeOrder).toHaveBeenCalledTimes(before + 1);
  expect(screen.getByLabelText("Código de rastreio").props.value).toBe("RASCUNHO");
  const previousState = AppState.currentState;
  Object.defineProperty(AppState, "currentState", { value: "background", configurable: true });
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(api.storeOrder).toHaveBeenCalledTimes(before + 1);
  Object.defineProperty(AppState, "currentState", { value: previousState, configurable: true });
  await act(async () => { onState("active"); });
  expect(api.storeOrder).toHaveBeenCalledTimes(before + 2);
  await act(async () => { screen.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
  expect(api.storeOrder).toHaveBeenCalledTimes(before + 3);
  screen.unmount();
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(api.storeOrder).toHaveBeenCalledTimes(before + 3);
  expect(remove).toHaveBeenCalled();
});

it("cliente usa os mesmos detalhes com filtros de acompanhamento e sem ações de gestão", async () => {
  const onNavigate = jest.fn(); const onBack = jest.fn(); const onProfilePress = jest.fn();
  const contact = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const screen = render(<ClientOrdersScreen onNavigate={onNavigate} onBack={onBack} onProfilePress={onProfilePress} />);
  expect(screen.getByLabelText("Pedidos").props.accessibilityState.selected).toBe(true);
  fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
  await screen.findByText("Pedido PED-A");
  expect(screen.queryByLabelText("Código de rastreio")).toBeNull();
  expect(screen.queryByLabelText("Pedido: Cancelado")).toBeNull();
  expect(screen.queryByText("Cliente: Ana · 1111")).toBeNull();
  fireEvent.press(screen.getByLabelText("Conversar com a loja no WhatsApp"));
  await waitFor(() => expect(contact).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/5592999999999?text=")));
  fireEvent.press(screen.getByLabelText("Pedidos"));
  await screen.findByLabelText("Abrir pedido PED-A");
  fireEvent.press(screen.getByLabelText("Filtrar: Concluídos"));
  await waitFor(() => expect(api.clientStoreOrders).toHaveBeenLastCalledWith(expect.objectContaining({ group: "COMPLETED", page: 1 })));
  fireEvent.press(screen.getByLabelText("Filtrar: Todos"));
  await waitFor(() => expect(api.clientStoreOrders).toHaveBeenLastCalledWith(expect.objectContaining({ group: undefined })));
  fireEvent.press(screen.getByLabelText("Abrir perfil"));
  fireEvent.press(screen.getByLabelText("Inicio"));
  expect(onProfilePress).toHaveBeenCalledTimes(1);
  expect(onNavigate).toHaveBeenCalledWith("home");
  expect(api.storeOrder).not.toHaveBeenCalled();
  expect(api.storeOrdersPage).not.toHaveBeenCalled();
});

it("usa o cabeçalho inicial e conecta voltar, perfil e abas do lojista", async () => {
  const onBack = jest.fn(); const onProducts = jest.fn(); const onPromotions = jest.fn(); const onSettings = jest.fn(); const onOpenProfile = jest.fn();
  const screen = render(<StoreOrdersScreen onBack={onBack} onProducts={onProducts} onPromotions={onPromotions} onSettings={onSettings} onOpenProfile={onOpenProfile} />);
  expect(screen.getByLabelText("Conecta Obras Itacoatiara")).toBeTruthy();
  fireEvent.press(await screen.findByLabelText("Abrir pedido PED-A"));
  await screen.findByText("Pedido PED-A");
  fireEvent.press(screen.getByLabelText("Voltar"));
  await screen.findByLabelText("Abrir pedido PED-A");
  expect(onBack).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Voltar"));
  fireEvent.press(screen.getByLabelText("Produtos"));
  fireEvent.press(screen.getByLabelText("Promoções"));
  fireEvent.press(screen.getByLabelText("Configurações"));
  fireEvent.press(screen.getByLabelText("Abrir perfil"));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onProducts).toHaveBeenCalledTimes(1);
  expect(onPromotions).toHaveBeenCalledTimes(1);
  expect(onSettings).toHaveBeenCalledTimes(1);
  expect(onOpenProfile).toHaveBeenCalledTimes(1);
});
