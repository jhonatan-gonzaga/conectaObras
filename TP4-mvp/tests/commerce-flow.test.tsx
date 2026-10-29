import { useEffect } from "react";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, ApiError, type AuthUser } from "../front-end/src/services/api";
import { CommerceProvider } from "../front-end/src/components/cliente/CommerceContext";
import { RootNavigator } from "../front-end/src/navigation/RootNavigator";
import { useAppNavigation } from "../front-end/src/navigation/useAppNavigation";
import { ProfileChoiceScreen } from "../front-end/src/pages/escolher-perfil";
import { publicProduct, publicStore } from "./catalog-fixtures";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("../front-end/src/services/image-upload", () => ({ pickProductImage: jest.fn(), pickAndUploadImage: jest.fn() }));
jest.mock("../front-end/src/services/store-logo", () => ({ pickStoreImage: jest.fn() }));
jest.mock("../front-end/src/services/audio-upload", () => ({ pickAndUploadAudio: jest.fn() }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-audio", () => ({}));
jest.mock("../front-end/src/components/native-date-time-field", () => ({ NativeDateTimeField: () => null }));
const client: AuthUser = { id: "client-a", role: "CLIENTE", name: "Cliente", email: "client@example.test" };

describe("commercial mode and existing personas", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(api, "me").mockResolvedValue(client);
    jest.spyOn(api, "storeIdentity").mockRejectedValue(new ApiError("Sem loja", 404));
    jest.spyOn(api, "productCategories").mockResolvedValue([publicProduct.category]);
    jest.spyOn(api, "publicStores").mockResolvedValue({ items: [publicStore], total: 1, page: 1, limit: 20 });
    jest.spyOn(api, "publicProducts").mockResolvedValue({ items: [publicProduct], total: 1, page: 1, limit: 20 });
    jest.spyOn(api, "publicStore").mockResolvedValue(publicStore);
    jest.spyOn(api, "publicProduct").mockResolvedValue({ ...publicProduct, stock: 2 });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["Cliente", "cliente"], ["Profissional", "profissional"], ["Dono de Loja", "lojista"], ["Loja", "loja"],
  ])("keeps %s as a distinct selection", async (label, value) => {
    const onContinue = jest.fn();
    const screen = render(<ProfileChoiceScreen onBack={jest.fn()} onContinue={onContinue} />);
    fireEvent.press(screen.getByLabelText(label));
    await act(async () => fireEvent.press(screen.getByLabelText(`Continuar como ${value}`)));
    expect(onContinue).toHaveBeenCalledWith(value);
  });

  it("opens commerce as CLIENTE without a new role or unnecessary role switch", async () => {
    const switchRole = jest.spyOn(api, "switchRole");
    const hook = renderHook(useAppNavigation);
    await waitFor(() => expect(hook.result.current.isSessionReady).toBe(true));
    await act(async () => hook.result.current.authenticate(true));
    await act(async () => hook.result.current.selectCommerce());
    expect(hook.result.current.authUser?.role).toBe("CLIENTE");
    expect(hook.result.current.screen).toBe("clientCommerceHome");
    expect(switchRole).not.toHaveBeenCalled();
    act(() => hook.result.current.openCommerceTab("search"));
    act(() => hook.result.current.openCatalog({ screen: "clientStoreDetail", id: publicStore.id }));
    act(() => hook.result.current.openCatalog({ screen: "clientProductDetail", id: publicProduct.id }));
    act(() => hook.result.current.backCatalog());
    expect(hook.result.current.catalogRoute).toEqual({ screen: "clientStoreDetail", id: publicStore.id });
    act(() => hook.result.current.backCatalog());
    expect(hook.result.current.screen).toBe("clientCommerceSearch");
  });

  it("uses the existing CLIENTE switch when a store owner selects consumer commerce", async () => {
    jest.spyOn(api, "me").mockResolvedValue({ ...client, role: "LOJISTA" });
    const switchRole = jest.spyOn(api, "switchRole").mockResolvedValue({ user: client, accessToken: "test" });
    const hook = renderHook(useAppNavigation);
    await waitFor(() => expect(hook.result.current.isSessionReady).toBe(true));
    await act(async () => hook.result.current.authenticate(true));
    await act(async () => hook.result.current.selectCommerce());
    expect(switchRole).toHaveBeenCalledWith("CLIENTE");
    expect(hook.result.current.screen).toBe("clientCommerceHome");
    await act(async () => hook.result.current.selectPersona("CLIENTE"));
    expect(hook.result.current.screen).toBe("clientHome");
    expect(hook.result.current.clientMode).toBe("services");
  });

  it("registers a new commerce user as CLIENTE and preserves their selected mode after signup", async () => {
    const hook = renderHook(useAppNavigation);
    await waitFor(() => expect(hook.result.current.isSessionReady).toBe(true));
    await act(async () => hook.result.current.selectCommerce());
    expect(hook.result.current.screen).toBe("signup");
    expect(hook.result.current.signupRole).toBe("CLIENTE");
    await act(async () => hook.result.current.authenticate());
    expect(hook.result.current.screen).toBe("clientCommerceHome");
  });

  it("runs profile → shopping → stores → real store → product → cart with correct totals and tabs", async () => {
    function App() {
      const navigation = useAppNavigation();
      useEffect(() => { if (navigation.isSessionReady) void navigation.authenticate(true); }, [navigation.isSessionReady]);
      return <CommerceProvider userId={navigation.authUser?.id} active={navigation.clientMode === "commerce"} tab={navigation.commerceTab} onNavigate={navigation.openCommerceTab}><RootNavigator navigation={navigation} isDarkMode={false} onToggleDarkMode={jest.fn()} /></CommerceProvider>;
    }
    const screen = render(<App />);
    fireEvent.press(await screen.findByLabelText("Loja"));
    await act(async () => fireEvent.press(screen.getByLabelText("Continuar como loja")));
    expect(await screen.findByRole("header", { name: "Início — Compras" })).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Lista de Lojas"));
    fireEvent.press(await screen.findByLabelText(`Ver loja ${publicStore.name}`));
    expect(await screen.findByRole("header", { name: "Página da Loja" })).toBeTruthy();
    fireEvent.press(await screen.findByLabelText(`Ver produto ${publicProduct.name}`));
    expect(await screen.findByText("Disponível em estoque (2 unidades)")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText(`Adicionar ao carrinho: ${publicProduct.name}`)));
    fireEvent.press(screen.getByRole("tab", { name: "Carrinho" }));
    expect(await screen.findByTestId("cart-total")).toHaveTextContent("R$ 38,90");
    await act(async () => fireEvent.press(screen.getByLabelText(`Aumentar quantidade: ${publicProduct.name}`)));
    expect(screen.getByTestId("cart-total")).toHaveTextContent("R$ 77,80");
    expect(screen.getByLabelText(`Aumentar quantidade: ${publicProduct.name}`)).toBeDisabled();
    await act(async () => fireEvent.press(screen.getByLabelText(`Diminuir quantidade: ${publicProduct.name}`)));
    expect(screen.getByTestId("cart-total")).toHaveTextContent("R$ 38,90");
    fireEvent.press(screen.getByLabelText(`Remover ${publicProduct.name}`));
    expect(screen.getByText("Seu carrinho está vazio")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Pedidos" }));
    expect(screen.getByText("Consulta de pedidos indisponível")).toBeTruthy();
    expect(screen.queryByText(/Continuar para Entrega|Finalizar compra|Pagamento/)).toBeNull();
    fireEvent.press(screen.getByRole("tab", { name: "Buscar" }));
    expect(screen.getByRole("header", { name: "Buscar materiais e lojas" })).toBeTruthy();
  });
});
