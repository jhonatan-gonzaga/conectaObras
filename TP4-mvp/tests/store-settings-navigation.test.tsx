import { useEffect } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, Pressable, Text } from "react-native";
import { StoreOwnerNavigator } from "../front-end/src/navigation/StoreOwnerNavigator";
import { useAppNavigation } from "../front-end/src/navigation/useAppNavigation";
import { isStoreOwnerContextScreen } from "../front-end/src/navigation/types";
import { api } from "../front-end/src/services/api";
import { emptyStoreForm, type StoreProfile } from "../front-end/src/services/store-form";
import { lookupPostalCode } from "../front-end/src/services/postal-code";
import { pickStoreLogo } from "../front-end/src/services/store-logo";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/services/store-logo", () => ({ pickStoreLogo: jest.fn() }));
jest.mock("../front-end/src/services/postal-code", () => ({ lookupPostalCode: jest.fn() }));
jest.mock("../front-end/src/components/native-date-time-field", () => {
  const React = require("react"); const { TextInput } = require("react-native");
  return { NativeDateTimeField: ({ label, value, onChange, disabled }: any) => React.createElement(TextInput, { accessibilityLabel: label, value, editable: !disabled, onChangeText: onChange }) };
});
const form = emptyStoreForm();
Object.assign(form, { name: "Loja Central", cnpj: "11222333000181", phone: "92999999999" });
Object.assign(form.address, { street: "Rua A", number: "1", neighborhood: "Centro", city: "Manaus", state: "AM", zipCode: "69000000" });
form.openingHours[0] = { dayOfWeek: "MONDAY", closed: false, openingTime: "08:00", closingTime: "18:00" };
const store: StoreProfile = { ...form, id: "store-a", status: "ACTIVE" };
function Flow() {
  const navigation = useAppNavigation();
  useEffect(() => { void navigation.authenticate(); }, []);
  if (navigation.screen === "accountProfile") return <Pressable onPress={() => navigation.setScreen(navigation.profileReturnScreen)}><Text>Voltar da conta</Text></Pressable>;
  return isStoreOwnerContextScreen(navigation.screen) ? <StoreOwnerNavigator screen={navigation.screen} navigation={navigation} /> : null;
}
async function openSettings() {
  const screen = render(<Flow />);
  fireEvent.press(await screen.findByText("Editar loja"));
  await screen.findByText("Ajustes da loja");
  return screen;
}
describe("store settings flow", () => {
  beforeEach(() => {
    jest.spyOn(api, "me").mockResolvedValue({ id: "owner-a", role: "LOJISTA" } as never);
    jest.spyOn(api, "myStore").mockResolvedValue(store);
    jest.spyOn(api, "storeDashboard").mockResolvedValue({ hasStore: true, activeProducts: 1, lowStockProducts: 0, activePromotions: 0, unreadMessages: 0, ordersByStatus: {} } as never);
    jest.spyOn(api, "storeDashboardList").mockResolvedValue([]);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
  it("opens distinct settings and returns to the dashboard", async () => {
    const screen = await openSettings();
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("Loja Central");
    fireEvent.press(screen.getByLabelText("Voltar ao painel"));
    expect(await screen.findByText("Painel da loja")).toBeTruthy();
  });
  it.each([["Pedidos", "orders", undefined], ["Catálogo", "active-products", undefined], ["Vendas", "orders", "COMPLETED"], ["Mensagens da loja", "messages", undefined]] as const)("opens %s and returns to its settings origin", async (label, kind, status) => {
    const screen = await openSettings();
    fireEvent.press(label === "Mensagens da loja" ? screen.getByLabelText(label) : screen.getByText(label));
    expect(await screen.findByText("Nenhum registro encontrado.")).toBeTruthy();
    expect(api.storeDashboardList).toHaveBeenCalledWith(kind, status);
    fireEvent.press(screen.getByText("Voltar"));
    expect(await screen.findByText("Ajustes da loja")).toBeTruthy();
  });
  it("previews saved data without changing persona and returns to settings", async () => {
    const screen = await openSettings();
    fireEvent.press(screen.getByText("Visualizar Loja como Cliente"));
    expect(await screen.findByText("CNPJ: 11.222.333/0001-81")).toBeTruthy();
    expect(screen.queryByLabelText("Nome da loja")).toBeNull();
    fireEvent.press(screen.getByText("Voltar aos ajustes"));
    expect(await screen.findByText("Ajustes da loja")).toBeTruthy();
  });
  it("opens the account with settings as its return route", async () => {
    const screen = await openSettings();
    fireEvent.press(screen.getByLabelText("Minha conta"));
    fireEvent.press(await screen.findByText("Voltar da conta"));
    expect(await screen.findByText("Ajustes da loja")).toBeTruthy();
  });
  it("requires discard confirmation before leaving edited settings", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const screen = await openSettings();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    fireEvent.press(screen.getByLabelText("Voltar ao painel"));
    expect(screen.getByText("Ajustes da loja")).toBeTruthy();
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => buttons.find((button) => button.text === "Descartar alterações")!.onPress!());
    expect(await screen.findByText("Painel da loja")).toBeTruthy();
  });
  it("saves actual edits and keeps API errors beside invalid fields", async () => {
    const save = jest.spyOn(api, "saveMyStore").mockResolvedValue({ ...store, name: "Loja atualizada" });
    const screen = await openSettings();
    fireEvent.changeText(screen.getByLabelText("CNPJ"), "11111111111111");
    fireEvent.press(screen.getByText("Salvar Alterações"));
    expect(screen.getByText("Informe um CNPJ válido.")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("CNPJ"), "11222333000181");
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Loja atualizada");
    await act(async () => fireEvent.press(screen.getByText("Salvar Alterações")));
    expect(await screen.findByText("Dados da loja salvos com sucesso.")).toBeTruthy();
    expect(save.mock.calls[0][0]).toMatchObject({ name: "Loja atualizada", cnpj: "11222333000181" });
  });
  it("fills address from CEP and preserves number and complement", async () => {
    (lookupPostalCode as jest.Mock).mockResolvedValue({ street: "Rua encontrada", neighborhood: "Novo bairro", city: "Manaus", state: "AM" });
    const screen = await openSettings();
    fireEvent.changeText(screen.getByLabelText("Complemento"), "Sala 4");
    await act(async () => fireEvent.press(screen.getByLabelText("Buscar CEP")));
    expect(screen.getByLabelText("Rua").props.value).toBe("Rua encontrada");
    expect(screen.getByLabelText("Número").props.value).toBe("1");
    expect(screen.getByLabelText("Complemento").props.value).toBe("Sala 4");
  });
  it("uploads a logo without losing unsaved form edits", async () => {
    (pickStoreLogo as jest.Mock).mockResolvedValue({ ...store, logoUrl: "https://example.com/logo.png" });
    const screen = await openSettings();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    await act(async () => fireEvent.press(screen.getByText("Adicionar logo")));
    expect(await screen.findByText("Logo atualizado com sucesso.")).toBeTruthy();
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("Alterada");
  });
  it("creates a real support ticket from the help dialog", async () => {
    const support = jest.spyOn(api, "createSupportTicket").mockResolvedValue({ id: "ticket-a" } as never);
    const screen = await openSettings();
    fireEvent.press(screen.getByText("Precisa de ajuda?"));
    fireEvent.changeText(screen.getByLabelText("Mensagem para o suporte"), "Preciso de ajuda com o cadastro");
    await act(async () => fireEvent.press(screen.getByText("Enviar ao suporte")));
    expect(await screen.findByText("Sua solicitação foi enviada ao suporte.")).toBeTruthy();
    expect(support).toHaveBeenCalledWith(expect.objectContaining({ message: "Preciso de ajuda com o cadastro" }));
    fireEvent.press(screen.getByText("Fechar ajuda"));
    expect(screen.queryByLabelText("Mensagem para o suporte")).toBeNull();
  });
});
