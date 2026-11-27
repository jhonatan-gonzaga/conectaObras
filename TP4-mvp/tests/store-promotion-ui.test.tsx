import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { api } from "../front-end/src/services/api";
import { StoreOwnerListScreen } from "../front-end/src/pages/lojista/StoreOwnerListScreen";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

describe("Store promotions tab", () => {
  afterEach(() => jest.restoreAllMocks());

  it("allows the owner to disable an enabled promotion", async () => {
    jest.spyOn(api, "storeDashboardList").mockResolvedValue([{
      id: "promotion-1", productId: "product-1", promotionalPrice: "24.00", discountPercent: null,
      startAt: "2099-10-10T10:00:00.000Z", endAt: "2099-10-11T10:00:00.000Z", enabled: true,
      product: { id: "product-1", name: "Furadeira", status: "ACTIVE", stock: 2 },
    }]);
    const toggle = jest.spyOn(api, "setStorePromotionEnabled").mockResolvedValue({ id: "promotion-1", enabled: false });
    const screen = render(<StoreOwnerListScreen kind="promotions" onBack={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("Desativar promoção")).toBeTruthy());
    fireEvent.press(screen.getByText("Desativar promoção"));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith("promotion-1", false));
    await waitFor(() => expect(screen.getByText("Ativar promoção")).toBeTruthy());
  });
  it("treats an enabled promotion past its end date as ended and not highlighted", async () => {
    jest.spyOn(api, "storeDashboardList").mockResolvedValue([{
      id: "promotion-expired", productId: "product-1", promotionalPrice: "24.00", discountPercent: null,
      startAt: "2020-10-10T10:00:00.000Z", endAt: "2020-10-11T10:00:00.000Z", enabled: true,
      product: { id: "product-1", name: "Furadeira", status: "ACTIVE", stock: 2, price: "30.00" },
    }]);
    const screen = render(<StoreOwnerListScreen kind="promotions" onBack={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("Encerrada")).toBeTruthy());
    expect(screen.getByText("Prazo encerrado. A oferta não altera o preço nem aparece em destaque.")).toBeTruthy();
    expect(screen.getByText("Desativar promoção")).toBeTruthy();
  });

  it("searches eligible products and lets the owner inspect and select one", async () => {
    jest.spyOn(api, "storeDashboardList").mockResolvedValue([]);
    jest.spyOn(api, "storeProducts").mockResolvedValue({
      items: [{
        id: "product-2", storeId: "store-1", categoryId: "tools", sku: "MART-01", name: "Martelo",
        description: "Martelo de aço com cabo emborrachado.", price: "35.00", stock: 7, status: "ACTIVE",
        lastPriceUpdateAt: "2026-10-12T10:00:00.000Z", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z",
        images: [{ id: "image-1", url: "https://example.test/martelo.png", altText: "Martelo", position: 0, isCover: true }],
      }], total: 1, page: 1, limit: 100,
    });
    const screen = render(<StoreOwnerListScreen kind="promotions" onBack={jest.fn()} />);
    expect(screen.getByLabelText("Promoções").props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByText("+ Nova promoção"));
    fireEvent.press(await screen.findByText("Selecionar produto"));
    await screen.findByText("Produtos disponíveis");
    fireEvent.changeText(screen.getByLabelText("Buscar produtos disponíveis"), "inexistente");
    expect(screen.getByText("Nenhum produto corresponde à busca.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Buscar produtos disponíveis"), "MART-01");
    fireEvent.press(await screen.findByLabelText("Ver detalhes de Martelo"));
    expect(screen.getByText("Martelo de aço com cabo emborrachado.")).toBeTruthy();
    fireEvent.press(screen.getByText("Selecionar este produto"));
    expect(screen.getByLabelText("Imagem de Martelo")).toBeTruthy();
    expect(screen.getByLabelText("Data de início")).toBeTruthy();
    expect(screen.getByLabelText("Horário de início")).toBeTruthy();
    expect(screen.getByLabelText("Data de término")).toBeTruthy();
    expect(screen.getByLabelText("Horário de término")).toBeTruthy();
  });
});
