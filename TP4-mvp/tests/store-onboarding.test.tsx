import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { StoreOwnerSetupScreen } from "../front-end/src/pages/lojista/StoreOwnerSetupScreen";
import { ApiError, api } from "../front-end/src/services/api";
import { emptyStoreForm, type StoreProfile } from "../front-end/src/services/store-form";

jest.mock("../front-end/src/services/store-logo", () => ({ pickStoreLogo: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/components/native-date-time-field", () => {
  const React = require("react");
  const { TextInput, Text, View } = require("react-native");
  return { NativeDateTimeField: ({ label, value, onChange, disabled, helperText, status }: any) => React.createElement(View, null, React.createElement(TextInput, { accessibilityLabel: label, value, editable: !disabled, onChangeText: onChange, status }), helperText ? React.createElement(Text, null, helperText) : null) };
});
const incomplete: StoreProfile = { id: "store-a", name: "Loja Central", status: "DRAFT" };
const callbacks = () => ({ onComplete: jest.fn(), onSwitchProfile: jest.fn(), onSignOut: jest.fn() });
function completeStore(): StoreProfile {
  const form = emptyStoreForm();
  Object.assign(form, { name: "Loja Central", cnpj: "11222333000181", phone: "92999999999" });
  Object.assign(form.address, { street: "Rua A", number: "1", neighborhood: "Centro", city: "Manaus", state: "AM", zipCode: "69000000" });
  form.openingHours[0] = { dayOfWeek: "MONDAY", closed: false, openingTime: "08:00", closingTime: "18:00" };
  return { ...incomplete, ...form };
}
async function open() {
  const props = callbacks();
  const screen = render(<StoreOwnerSetupScreen {...props} />);
  await screen.findByText("Dados da Loja");
  return { screen, props };
}
function finalStep(screen: ReturnType<typeof render>) {
  for (let i = 0; i < 2; i++) fireEvent.press(screen.getByText("Próxima etapa"));
}
describe("store registration", () => {
  beforeEach(() => {
    jest.spyOn(api, "myStore").mockResolvedValue(incomplete);
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: false, pending: ["CNPJ_REQUIRED"] });
  });
  afterEach(() => jest.restoreAllMocks());
  it("restores legacy saved data after reopening without exposing draft or dashboard actions", async () => {
    const first = await open();
    expect(first.screen.getByLabelText("Nome da loja").props.value).toBe("Loja Central");
    first.screen.unmount();
    const second = await open();
    expect(second.screen.getByLabelText("Nome da loja").props.value).toBe("Loja Central");
    expect(second.screen.queryByText("Salvar rascunho")).toBeNull();
    expect(second.screen.queryByText("Ir para o painel")).toBeNull();
    finalStep(second.screen);
    expect(second.screen.queryByText("Resumo antes de ativar")).toBeNull();
    expect(second.screen.queryByText("Ativar loja")).toBeNull();
  });
  it("retries a loading error without presenting an empty form", async () => {
    jest.spyOn(api, "myStore").mockRejectedValueOnce(new ApiError("Servidor indisponível", 503)).mockResolvedValueOnce(incomplete);
    const screen = render(<StoreOwnerSetupScreen {...callbacks()} />);
    expect(await screen.findByText("Servidor indisponível")).toBeTruthy();
    expect(screen.queryByLabelText("Nome da loja")).toBeNull();
    fireEvent.press(screen.getByText("Tentar novamente"));
    expect(await screen.findByLabelText("Nome da loja")).toBeTruthy();
  });
  it("does not turn an existing store into an empty registration if readiness is unavailable", async () => {
    jest.spyOn(api, "storeActivationReadiness").mockRejectedValue(new ApiError("Consulta indisponível", 404));
    const screen = render(<StoreOwnerSetupScreen {...callbacks()} />);
    expect(await screen.findByText("Consulta indisponível")).toBeTruthy();
    expect(screen.queryByText("Cadastre sua loja")).toBeNull();
  });
  it("starts registration only when the store itself returns 404", async () => {
    jest.spyOn(api, "myStore").mockRejectedValue(new ApiError("Loja não encontrada", 404));
    const screen = render(<StoreOwnerSetupScreen {...callbacks()} />);
    expect(await screen.findByText("Cadastre sua loja")).toBeTruthy();
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("");
    expect(api.storeActivationReadiness).not.toHaveBeenCalled();
  });
  it("marks correct values green and removes the marker for invalid or empty values", async () => {
    const { screen } = await open();
    expect(screen.getByLabelText("Nome da loja válido")).toBeTruthy();
    expect(screen.queryByLabelText("CNPJ válido")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("CNPJ"), "11222333000181");
    expect(screen.getByLabelText("CNPJ válido")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("CNPJ"), "11111111111111");
    expect(screen.queryByLabelText("CNPJ válido")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "");
    expect(screen.queryByLabelText("Nome da loja válido")).toBeNull();
  });
  it("shows validation beside the field and never saves partial registration", async () => {
    const save = jest.spyOn(api, "saveMyStore");
    const { screen, props } = await open();
    fireEvent.changeText(screen.getByLabelText("CNPJ"), "11111111111111");
    finalStep(screen);
    fireEvent.press(screen.getByText("Concluir Cadastro da Loja"));
    expect(screen.getByText("Informe um CNPJ válido.")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    expect(props.onComplete).not.toHaveBeenCalled();
  });
  it("preserves edits on API failure and retries the complete registration", async () => {
    const complete = completeStore();
    jest.spyOn(api, "myStore").mockResolvedValue(complete);
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: true, pending: [] });
    const save = jest.spyOn(api, "saveMyStore").mockRejectedValueOnce(new ApiError("Falha ao salvar", 500)).mockResolvedValueOnce({ ...complete, name: "Loja nova" });
    const { screen, props } = await open();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Loja nova");
    finalStep(screen);
    await act(async () => fireEvent.press(screen.getByText("Concluir Cadastro da Loja")));
    expect(await screen.findByText("Falha ao salvar")).toBeTruthy();
    expect(props.onComplete).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText("Tentar salvar novamente")));
    expect(await screen.findByText("Cadastro da loja concluído com sucesso.")).toBeTruthy();
    expect(save.mock.calls[1][0]).toMatchObject({ name: "Loja nova", openingHours: expect.any(Array) });
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  });
  it("clears and disables times on closed days, and marks valid open times", async () => {
    const { screen } = await open();
    finalStep(screen);
    const closed = screen.getByLabelText("Segunda-feira fechado");
    fireEvent(closed, "valueChange", false);
    fireEvent.changeText(screen.getByLabelText("Abertura Segunda-feira"), "08:00");
    fireEvent.changeText(screen.getByLabelText("Fechamento Segunda-feira"), "18:00");
    expect(screen.getByLabelText("Fechamento Segunda-feira").props.status).toBe("valid");
    fireEvent(closed, "valueChange", true);
    expect(screen.getByLabelText("Abertura Segunda-feira", { includeHiddenElements: true }).props).toMatchObject({ value: "", editable: false, status: "default" });
  });
  it("returns to the previous step and preserves data before leaving", async () => {
    const { screen, props } = await open();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    fireEvent.press(screen.getByText("Próxima etapa"));
    fireEvent.press(screen.getByLabelText("Voltar"));
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("Alterada");
    expect(props.onSwitchProfile).not.toHaveBeenCalled();
  });
  it("keeps the user in registration and shows API pending beside its field", async () => {
    const complete = completeStore();
    jest.spyOn(api, "myStore").mockResolvedValue(complete);
    jest.spyOn(api, "saveMyStore").mockResolvedValue(complete);
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: false, pending: ["CNPJ_INVALID"] });
    const { screen, props } = await open();
    finalStep(screen);
    await act(async () => fireEvent.press(screen.getByText("Concluir Cadastro da Loja")));
    expect(props.onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("CNPJ inválido")).toBeTruthy();
    expect(screen.queryByLabelText("CNPJ válido")).toBeNull();
    expect(screen.queryByText("Cadastro da loja concluído com sucesso.")).toBeNull();
  });
  it("navigates to the dashboard only after saving a complete registration approved by the API", async () => {
    const complete = completeStore();
    jest.spyOn(api, "myStore").mockResolvedValue(complete);
    jest.spyOn(api, "saveMyStore").mockResolvedValue(complete);
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: true, pending: [] });
    const { screen, props } = await open();
    finalStep(screen);
    await act(async () => fireEvent.press(screen.getByText("Concluir Cadastro da Loja")));
    expect(props.onComplete).toHaveBeenCalledTimes(1);
  });
  it("warns before leaving with unsaved changes", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const { screen, props } = await open();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    fireEvent.press(screen.getByText("Trocar perfil"));
    expect(alert).toHaveBeenCalledWith("Alterações não salvas", expect.any(String), expect.any(Array));
    expect(props.onSwitchProfile).not.toHaveBeenCalled();
  });
});
