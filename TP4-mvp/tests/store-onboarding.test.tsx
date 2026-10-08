import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { StoreOwnerSetupScreen } from "../front-end/src/pages/lojista/StoreOwnerSetupScreen";
import { ApiError, api } from "../front-end/src/services/api";
import { emptyStoreForm, type StoreProfile } from "../front-end/src/services/store-form";

jest.mock("../front-end/src/services/store-logo", () => ({ pickStoreLogo: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/components/native-date-time-field", () => {
  const React = require("react");
  const { TextInput, Text, View } = require("react-native");
  return { NativeDateTimeField: ({ label, value, onChange, disabled, helperText }: any) => React.createElement(View, null, React.createElement(TextInput, { accessibilityLabel: label, value, editable: !disabled, onChangeText: onChange }), helperText ? React.createElement(Text, null, helperText) : null) };
});
const store: StoreProfile = { id: "store-a", name: "Loja Central", status: "DRAFT" };
const props = () => ({ onComplete: jest.fn(), onSwitchProfile: jest.fn(), onSignOut: jest.fn() });
function completeStore(): StoreProfile {
    const form = emptyStoreForm();
    Object.assign(form, { name: "Loja Central", cnpj: "11222333000181", phone: "92999999999" });
    Object.assign(form.address, { street: "Rua A", number: "1", neighborhood: "Centro", city: "Manaus", state: "AM", zipCode: "69000000" });
    form.openingHours[0] = { dayOfWeek: "MONDAY", closed: false, openingTime: "08:00", closingTime: "18:00" };
    return { ...store, ...form };
}
async function open() {
  const callbacks = props();
  const screen = render(<StoreOwnerSetupScreen {...callbacks} />);
  await screen.findByText("Dados da Loja");
  return { screen, callbacks };
}
async function review(screen: ReturnType<typeof render>) {
  for (let i = 0; i < 2; i++) fireEvent.press(screen.getByText("Próxima etapa"));
}
describe("store onboarding and editing", () => {
  beforeEach(() => {
    jest.spyOn(api, "myStore").mockResolvedValue(store);
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: false, pending: ["CNPJ_REQUIRED"] });
  });
  afterEach(() => jest.restoreAllMocks());
  it("loads a saved draft and resumes it after reopening", async () => {
    let persisted = store;
    jest.spyOn(api, "myStore").mockImplementation(async () => persisted);
    jest.spyOn(api, "saveMyStore").mockImplementation(async (payload) => {
      persisted = { ...store, ...payload } as StoreProfile;
      return persisted;
    });
    const first = await open();
    fireEvent.changeText(first.screen.getByLabelText("Nome da loja"), "Loja salva");
    await act(async () => fireEvent.press(first.screen.getByText("Salvar rascunho")));
    expect(await first.screen.findByText("Rascunho salvo. Você pode retomar o cadastro depois.")).toBeTruthy();
    first.screen.unmount();
    const second = await open();
    expect(second.screen.getByLabelText("Nome da loja").props.value).toBe("Loja salva");
    expect(api.myStore).toHaveBeenCalledTimes(2);
  });
  it("retries a loading error without presenting an empty form", async () => {
    jest.spyOn(api, "myStore").mockRejectedValueOnce(new ApiError("Servidor indisponível", 503)).mockResolvedValueOnce(store);
    const screen = render(<StoreOwnerSetupScreen {...props()} />);
    expect(await screen.findByText("Servidor indisponível")).toBeTruthy();
    expect(screen.queryByLabelText("Nome da loja")).toBeNull();
    fireEvent.press(screen.getByText("Tentar novamente"));
    expect(await screen.findByLabelText("Nome da loja")).toBeTruthy();
  });
  it("does not turn an existing store into an empty draft if readiness is unavailable", async () => {
    jest.spyOn(api, "storeActivationReadiness").mockRejectedValue(new ApiError("Consulta indisponível", 404));
    const screen = render(<StoreOwnerSetupScreen {...props()} />);
    expect(await screen.findByText("Consulta indisponível")).toBeTruthy();
    expect(screen.queryByText("Cadastre sua loja")).toBeNull();
  });
  it("starts a new draft only when the store itself returns 404", async () => {
    jest.spyOn(api, "myStore").mockRejectedValue(new ApiError("Loja não encontrada", 404));
    const screen = render(<StoreOwnerSetupScreen {...props()} />);
    expect(await screen.findByText("Cadastre sua loja")).toBeTruthy();
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("");
    expect(api.storeActivationReadiness).not.toHaveBeenCalled();
  });
  it("shows validation beside the field and does not send invalid data", async () => {
    const save = jest.spyOn(api, "saveMyStore");
    const { screen } = await open();
    fireEvent.changeText(screen.getByLabelText("CNPJ"), "11111111111111");
    fireEvent.press(screen.getByText("Salvar rascunho"));
    expect(screen.getByText("Informe um CNPJ válido.")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });
  it("preserves unsaved edits on API failure and retries saving successfully", async () => {
    const save = jest.spyOn(api, "saveMyStore").mockRejectedValueOnce(new ApiError("Falha ao salvar", 500)).mockResolvedValueOnce({ ...store, name: "Loja nova" });
    const { screen } = await open();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Loja nova");
    await act(async () => fireEvent.press(screen.getByText("Salvar rascunho")));
    expect(await screen.findByText("Falha ao salvar")).toBeTruthy();
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("Loja nova");
    await act(async () => fireEvent.press(screen.getByText("Tentar salvar novamente")));
    expect(await screen.findByText("Rascunho salvo. Você pode retomar o cadastro depois.")).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ name: "Loja nova", openingHours: expect.any(Array) });
  });
  it("clears and disables times on closed days", async () => {
    const { screen } = await open();
    fireEvent.press(screen.getByText("Próxima etapa")); fireEvent.press(screen.getByText("Próxima etapa"));
    const closed = screen.getByLabelText("Segunda-feira fechado");
    fireEvent(closed, "valueChange", false);
    fireEvent.changeText(screen.getByLabelText("Abertura Segunda-feira"), "08:00");
    fireEvent.changeText(screen.getByLabelText("Fechamento Segunda-feira"), "18:00");
    fireEvent(closed, "valueChange", true);
    expect(screen.getByLabelText("Abertura Segunda-feira", { includeHiddenElements: true }).props).toMatchObject({ value: "", editable: false });
    expect(screen.getByLabelText("Fechamento Segunda-feira", { includeHiddenElements: true }).props).toMatchObject({ value: "", editable: false });
  });
  it("does not offer activation when the API reports pending requirements", async () => {
    const { screen } = await open();
    await review(screen);
    expect(screen.getByText("CNPJ obrigatório")).toBeTruthy();
    expect(screen.queryByText("Ativar loja")).toBeNull();
  });
  it("activates only a saved form approved by the API and shows success", async () => {
    const complete = completeStore();
    jest.spyOn(api, "myStore").mockResolvedValue(complete);
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: true, pending: [] });
    const activate = jest.spyOn(api, "changeMyStoreStatus").mockResolvedValue({ ...complete, status: "ACTIVE" });
    const { screen } = await open();
    await waitFor(() => expect(api.storeActivationReadiness).toHaveBeenCalled());
    await review(screen);
    await act(async () => fireEvent.press(screen.getByText("Ativar loja")));
    expect(await screen.findByText("Loja ativada com sucesso.")).toBeTruthy();
    expect(activate).toHaveBeenCalledWith("ACTIVE");
    expect(screen.queryByText("Ativar loja")).toBeNull();
  });
  it("shows server pending requirements when activation is rejected and hides the action", async () => {
    jest.spyOn(api, "myStore").mockResolvedValue(completeStore());
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: true, pending: [] });
    jest.spyOn(api, "changeMyStoreStatus").mockRejectedValue(new ApiError("Revise o cadastro", 400, { pending: ["CNPJ_INVALID"] }));
    const { screen } = await open();
    await review(screen);
    await act(async () => fireEvent.press(screen.getByText("Ativar loja")));
    expect(await screen.findByText("Revise o cadastro")).toBeTruthy();
    expect(screen.getByText("CNPJ inválido")).toBeTruthy();
    expect(screen.queryByText("Ativar loja")).toBeNull();
    for (let i = 0; i < 2; i++) fireEvent.press(screen.getByText("Etapa anterior"));
    expect(screen.getByText("CNPJ inválido")).toBeTruthy();
  });
  it("returns to the previous step and preserves data before leaving the screen", async () => {
    const { screen, callbacks } = await open();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    fireEvent.press(screen.getByText("Próxima etapa"));
    fireEvent.press(screen.getByLabelText("Voltar"));
    expect(screen.getByLabelText("Nome da loja").props.value).toBe("Alterada");
    expect(callbacks.onSwitchProfile).not.toHaveBeenCalled();
  });
  it("brings a missing required phone into view when concluding registration", async () => {
    const complete = completeStore();
    jest.spyOn(api, "myStore").mockResolvedValue({ ...complete, phone: "" });
    const { screen } = await open();
    await review(screen);
    fireEvent.press(screen.getByText("Concluir Cadastro da Loja"));
    expect(screen.getByLabelText("Telefone")).toBeTruthy();
    expect(screen.getByText("Informe DDD e telefone válido.")).toBeTruthy();
  });
  it("keeps the user in registration when the API still reports pending requirements", async () => {
    const complete = completeStore();
    jest.spyOn(api, "myStore").mockResolvedValue(complete);
    jest.spyOn(api, "saveMyStore").mockResolvedValue(complete);
    jest.spyOn(api, "storeActivationReadiness").mockResolvedValue({ allowed: false, pending: ["CNPJ_INVALID"] });
    const { screen, callbacks } = await open();
    await review(screen);
    await act(async () => fireEvent.press(screen.getByText("Concluir Cadastro da Loja")));
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("CNPJ inválido")).toBeTruthy();
  });
  it("warns before leaving with unsaved changes", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const { screen, callbacks } = await open();
    fireEvent.changeText(screen.getByLabelText("Nome da loja"), "Alterada");
    fireEvent.press(screen.getByText("Trocar perfil"));
    expect(alert).toHaveBeenCalledWith("Alterações não salvas", expect.any(String), expect.any(Array));
    expect(callbacks.onSwitchProfile).not.toHaveBeenCalled();
  });
});
