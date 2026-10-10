import { useEffect } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, Pressable, Text } from "react-native";
import { StoreOwnerNavigator } from "../front-end/src/navigation/StoreOwnerNavigator";
import { useAppNavigation } from "../front-end/src/navigation/useAppNavigation";
import { isStoreOwnerContextScreen } from "../front-end/src/navigation/types";
import { api } from "../front-end/src/services/api";
import { emptyStoreForm, type StoreProfile } from "../front-end/src/services/store-form";
import { lookupPostalCode } from "../front-end/src/services/postal-code";
import { pickStoreImage } from "../front-end/src/services/store-logo";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/services/store-logo", () => ({ pickStoreImage: jest.fn() }));
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
    jest.spyOn(api, "me").mockResolvedValue({ id: "owner-a", role: "LOJISTA", avatarUrl: "https://example.com/avatar.png" } as never);
    jest.spyOn(api, "myStore").mockResolvedValue(store);
    jest.spyOn(api, "storeDashboard").mockResolvedValue({ hasStore: true, activeProducts: 1, lowStockProducts: 0, activePromotions: 0, unreadMessages: 0, ordersByStatus: {} } as never);
    jest.spyOn(api, "storeDashboardList").mockResolvedValue([]);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
  it("opens distinct settings and returns to the dashboard", async () => {
    const screen = await openSettings();
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("Loja Central");
    fireEvent.press(screen.getByLabelText("Voltar"));
    expect(await screen.findByText("Painel da loja")).toBeTruthy();
  });
  it("uses the professional header with the account avatar, without messages or footer tabs", async () => {
    const screen = await openSettings();
    expect((await screen.findByLabelText("Foto do perfil")).props.source.uri).toBe("https://example.com/avatar.png");
    expect(screen.getByLabelText("Conecta Obras Itacoatiara")).toBeTruthy();
    expect(screen.queryByLabelText("Mensagens da loja")).toBeNull();
    for (const tab of ["Visão", "Pedidos", "Catálogo", "Vendas", "Ajustes"]) expect(screen.queryByText(tab)).toBeNull();
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
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    fireEvent.press(await screen.findByText("Voltar da conta"));
    expect(await screen.findByText("Ajustes da loja")).toBeTruthy();
  });
  it("requires discard confirmation before leaving edited settings", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const screen = await openSettings();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    fireEvent.press(screen.getByLabelText("Voltar"));
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
  it("keeps activation in settings after completing registration", async () => {
    jest.spyOn(api, "myStore").mockResolvedValue({ ...store, status: "DRAFT" });
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: true, pending: [] });
    const activate = jest.spyOn(api, "changeMyStoreStatus").mockResolvedValue(store);
    const screen = await openSettings();
    await act(async () => fireEvent.press(screen.getByText("Ativar loja")));
    expect(await screen.findByText("Loja ativada com sucesso.")).toBeTruthy();
    expect(activate).toHaveBeenCalledWith("ACTIVE");
  });
  it("cannot make a complete DRAFT registration incomplete from settings", async () => {
    jest.spyOn(api, "myStore").mockResolvedValue({ ...store, status: "DRAFT" });
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: true, pending: [] });
    const save = jest.spyOn(api, "saveMyStore");
    const screen = await openSettings();
    fireEvent.changeText(screen.getByLabelText("Telefone"), "");
    fireEvent.press(screen.getByText("Salvar Alterações"));
    expect(screen.getByText("Informe DDD e telefone válido.")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
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
  it("previews both selected images without losing edits and uploads only on save", async () => {
    (pickStoreImage as jest.Mock).mockImplementation(async (kind) => ({ uri: `file:///${kind}.png`, name: `${kind}.png`, type: "image/png" }));
    const save = jest.spyOn(api, "saveMyStore").mockResolvedValue({ ...store, name: "Alterada" });
    const upload = jest.spyOn(api, "uploadStoreImage").mockImplementation(async (kind) => ({ ...store, name: "Alterada", logoUrl: "https://example.com/cover.png", ...(kind === "background" ? { backgroundUrl: "https://example.com/background.png" } : {}) }));
    const screen = await openSettings();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    await act(async () => fireEvent.press(screen.getByText("Adicionar capa")));
    await act(async () => fireEvent.press(screen.getByText("Adicionar fundo")));
    expect(screen.getByLabelText("Capa da loja").props.source.uri).toBe("file:///cover.png");
    expect(screen.getByLabelText("Fundo da loja").props.source.uri).toBe("file:///background.png");
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("Alterada");
    expect(upload).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText("Salvar Alterações")));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Alterada" }));
    expect(upload).toHaveBeenNthCalledWith(1, "cover", expect.objectContaining({ uri: "file:///cover.png" }));
    expect(upload).toHaveBeenNthCalledWith(2, "background", expect.objectContaining({ uri: "file:///background.png" }));
    expect(screen.getByLabelText("Fundo da loja").props.source.uri).toBe("https://example.com/background.png");
    expect(screen.queryByText("Alterações não salvas")).toBeNull();
  });
  it("retains a failed background for retry without resending a saved cover", async () => {
    (pickStoreImage as jest.Mock).mockImplementation(async (kind) => ({ uri: `file:///${kind}.png`, name: `${kind}.png`, type: "image/png" }));
    jest.spyOn(api, "saveMyStore").mockResolvedValue(store);
    const upload = jest.spyOn(api, "uploadStoreImage")
      .mockResolvedValueOnce({ ...store, logoUrl: "https://example.com/cover.png" })
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ ...store, logoUrl: "https://example.com/cover.png", backgroundUrl: "https://example.com/background.png" });
    const screen = await openSettings();
    await act(async () => fireEvent.press(screen.getByText("Adicionar capa")));
    await act(async () => fireEvent.press(screen.getByText("Adicionar fundo")));
    await act(async () => fireEvent.press(screen.getByText("Salvar Alterações")));
    expect(screen.getByLabelText("Fundo da loja").props.source.uri).toBe("file:///background.png");
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Tentar salvar novamente")));
    expect(upload.mock.calls.map(([kind]) => kind)).toEqual(["cover", "background", "background"]);
    expect(await screen.findByText("Dados da loja salvos com sucesso.")).toBeTruthy();
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
