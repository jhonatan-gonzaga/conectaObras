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
});
