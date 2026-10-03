import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StoreOwnerScreen } from "../front-end/src/pages/lojista/StoreOwnerScreen";
import { api } from "../front-end/src/services/api";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn().mockResolvedValue(undefined), deleteItemAsync: jest.fn().mockResolvedValue(undefined) }));

describe("StoreOwner screens", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows live aggregate counts and opens the matching lists", async () => {
    jest.spyOn(api, "storeDashboard").mockResolvedValue({ hasStore: true, activeProducts: 7, lowStockProducts: 2, activePromotions: 1, ordersByStatus: { PENDING: 3 }, unreadMessages: 4 });
    const openList = jest.fn();
    const openOrders = jest.fn();
    const screen = render(<StoreOwnerScreen onOpenList={openList} onOpenOrders={openOrders} onStoreMissing={jest.fn()} onSignOut={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("7")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Estoque baixo: 2"));
    fireEvent.press(screen.getByLabelText("Pendentes: 3"));
    fireEvent.press(screen.getByLabelText("Promocoes ativas: 1"));
    fireEvent.press(screen.getByLabelText("Mensagens nao lidas: 4"));
    expect(openList).toHaveBeenCalledWith("low-stock");
    expect(openList).toHaveBeenCalledWith("promotions");
    expect(openList).toHaveBeenCalledWith("messages");
    expect(openOrders).toHaveBeenCalledWith("PENDING");
  });

  it("renders loading and recoverable error states", async () => {
    let rejectRequest!: (reason: Error) => void;
    jest.spyOn(api, "storeDashboard").mockImplementation(() => new Promise((_, reject) => { rejectRequest = reject; }));
    const screen = render(<StoreOwnerScreen onOpenList={jest.fn()} onOpenOrders={jest.fn()} onStoreMissing={jest.fn()} onSignOut={jest.fn()} />);
    expect(screen.getByText("Carregando indicadores...")).toBeTruthy();
    await act(async () => rejectRequest(new Error("network")));
    expect(await screen.findByText("Nao foi possivel carregar o painel.")).toBeTruthy();
  });

  it("routes a dashboard whose store disappeared back to onboarding", async () => {
    jest.spyOn(api, "storeDashboard").mockResolvedValue({ hasStore: false, activeProducts: 0, lowStockProducts: 0, activePromotions: 0, ordersByStatus: {}, unreadMessages: 0 });
    const storeMissing = jest.fn();
    const screen = render(<StoreOwnerScreen onOpenList={jest.fn()} onOpenOrders={jest.fn()} onStoreMissing={storeMissing} onSignOut={jest.fn()} />);
    await waitFor(() => expect(storeMissing).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Produtos ativos")).toBeNull();
  });

});
