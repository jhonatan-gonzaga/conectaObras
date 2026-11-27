import { fireEvent, render } from "@testing-library/react-native";
import { CommerceOrdersFeedback } from "../front-end/src/components/cliente/CommerceOrdersFeedback";
import { CommerceOrdersPage } from "../front-end/src/pages/cliente/CommerceOrdersPage";
import { api } from "../front-end/src/services/api";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

describe("consumer orders", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows the unavailable empty state without calling owner endpoints or inventing orders", async () => {
    jest.spyOn(api, "me").mockResolvedValue({ id: "customer", name: "Cliente", avatarUrl: "/uploads/avatar.png" } as never);
    const ownerOrders = jest.spyOn(api, "storeOrders");
    const ownerOrder = jest.spyOn(api, "storeOrder");
    const onStores = jest.fn(), onBack = jest.fn(), onProfilePress = jest.fn();
    const screen = render(<CommerceOrdersPage onStores={onStores} onBack={onBack} onProfilePress={onProfilePress} />);

    expect(await screen.findByLabelText("Foto do perfil")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Meus Pedidos" })).toBeTruthy();
    expect(screen.getByText("Acompanhe seus pedidos e consulte suas compras anteriores.")).toBeTruthy();
    expect(screen.getByText("Seus pedidos aparecerão aqui")).toBeTruthy();
    expect(screen.getByText(/A consulta de pedidos ainda não está disponível para clientes/)).toBeTruthy();
    expect(screen.queryByText(/CO-8942|CO-8710|CO-8521|R\$|Entregue|Em separação/)).toBeNull();
    expect(ownerOrders).not.toHaveBeenCalled();
    expect(ownerOrder).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Em aberto")).toHaveAccessibilityState({ selected: true });
    for (const label of ["Concluídos", "Todos", "Em aberto"]) {
      fireEvent.press(screen.getByLabelText(label));
      expect(screen.getByLabelText(label)).toHaveAccessibilityState({ selected: true });
      expect(screen.getByText("Seus pedidos aparecerão aqui")).toBeTruthy();
    }
    fireEvent.press(screen.getByLabelText("Explorar Lojas"));
    fireEvent.press(screen.getByLabelText("Voltar"));
    fireEvent.press(screen.getByLabelText("Abrir perfil"));
    expect(onStores).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });

  it("provides loading and error feedback with a working retry action", () => {
    const onRetry = jest.fn(), onStores = jest.fn();
    const screen = render(<CommerceOrdersFeedback state={{ status: "loading" }} onStores={onStores} />);
    expect(screen.getByLabelText("Carregando pedidos")).toBeTruthy();
    expect(screen.queryByText("Seus pedidos aparecerão aqui")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();

    screen.rerender(<CommerceOrdersFeedback state={{ status: "error", onRetry }} onStores={onStores} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar seus pedidos");
    fireEvent.press(screen.getByLabelText("Tentar novamente"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onStores).not.toHaveBeenCalled();

    screen.rerender(<CommerceOrdersFeedback state={{ status: "empty" }} onStores={onStores} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Seus pedidos aparecerão aqui")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Explorar Lojas"));
    expect(onStores).toHaveBeenCalledTimes(1);
  });
});
