import { render } from "@testing-library/react-native";
import { ProfileChoiceScreen } from "../front-end/src/pages/escolher-perfil";
import { ApiError, api } from "../front-end/src/services/api";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn().mockResolvedValue(undefined), deleteItemAsync: jest.fn().mockResolvedValue(undefined) }));

describe("ProfileChoiceScreen store identity", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows the registered store name and a return message for an authenticated user", async () => {
    jest.spyOn(api, "storeIdentity").mockResolvedValue({ name: "Loja Central", status: "ACTIVE" });
    const screen = render(<ProfileChoiceScreen onBack={jest.fn()} onContinue={jest.fn()} isAuthenticated activeRole="cliente" />);

    expect(await screen.findByText("Loja Central")).toBeTruthy();
    expect(screen.getByText("Sua loja já está cadastrada. Toque para acessar o painel.")).toBeTruthy();
    expect(screen.getByLabelText("Loja Central")).toBeTruthy();
  });

  it("keeps the signup option when there is no store", async () => {
    jest.spyOn(api, "storeIdentity").mockRejectedValue(new ApiError("Loja não encontrada", 404));
    const screen = render(<ProfileChoiceScreen onBack={jest.fn()} onContinue={jest.fn()} isAuthenticated />);

    expect(await screen.findByText("Cadastre sua loja e venda produtos locais")).toBeTruthy();
    expect(screen.getByLabelText("Lojista")).toBeTruthy();
  });

  it("does not suggest a new registration when the lookup fails", async () => {
    jest.spyOn(api, "storeIdentity").mockRejectedValue(new ApiError("Serviço indisponível", 503));
    const screen = render(<ProfileChoiceScreen onBack={jest.fn()} onContinue={jest.fn()} isAuthenticated />);

    expect(await screen.findByText("Não foi possível consultar sua loja. Você ainda pode acessar o perfil Lojista.")).toBeTruthy();
  });

  it("does not request a store for a new user", () => {
    const identity = jest.spyOn(api, "storeIdentity");
    render(<ProfileChoiceScreen onBack={jest.fn()} onContinue={jest.fn()} />);
    expect(identity).not.toHaveBeenCalled();
  });
});
