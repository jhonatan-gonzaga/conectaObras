import { useEffect } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { StorePromotionsScreen } from "../front-end/src/pages/lojista/StorePromotionsScreen";
import { StorePromotionFormScreen } from "../front-end/src/pages/lojista/StorePromotionFormScreen";
import { StoreOwnerNavigator } from "../front-end/src/navigation/StoreOwnerNavigator";
import { useAppNavigation } from "../front-end/src/navigation/useAppNavigation";
import { isStoreOwnerContextScreen } from "../front-end/src/navigation/types";
import { ApiError, api } from "../front-end/src/services/api";
import type { StoreProduct } from "../front-end/src/services/store-products";
import type { StorePromotion } from "../front-end/src/services/store-promotions";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/components/native-date-time-field", () => {
  const React = require("react"); const { TextInput } = require("react-native");
  return { NativeDateTimeField: ({ label, value, onChange, disabled }: any) => React.createElement(TextInput, { accessibilityLabel: label, value, editable: !disabled, onChangeText: onChange }) };
});
const product = { id: "p1", name: "Porcelanato", price: "89.90", sku: "POR-60", stock: 12, status: "ACTIVE", images: [] } as unknown as StoreProduct;
const promotion: StorePromotion = { id: "promo1", name: "Oferta pisos", productId: "p1", product, discountType: "PERCENTAGE", discountValue: "20.00", discountPct: "20.00", startsAt: "2030-10-15T11:00:00.000Z", endsAt: "2030-10-23T02:59:00.000Z", status: "ACTIVE" };
const listProps = { onBack: jest.fn(), onCreate: jest.fn(), onEdit: jest.fn(), onProducts: jest.fn(), onOrders: jest.fn(), onSettings: jest.fn() };
function Flow() {
  const navigation = useAppNavigation();
  useEffect(() => navigation.setScreen("storeOwnerDashboard"), []);
  return isStoreOwnerContextScreen(navigation.screen) ? <StoreOwnerNavigator screen={navigation.screen} navigation={navigation} /> : null;
}
async function fillForm() {
  const onSaved = jest.fn();
  const screen = render(<StorePromotionFormScreen id={null} onBack={jest.fn()} onSaved={onSaved} />);
  fireEvent.changeText(await screen.findByLabelText("Nome da promoção"), "Oferta pisos");
  fireEvent.press(screen.getByLabelText("Selecionar produto"));
  fireEvent.press(await screen.findByLabelText("Selecionar Porcelanato"));
  fireEvent.changeText(screen.getByLabelText("Valor do desconto"), "20");
  fireEvent.changeText(screen.getByLabelText("Data de início"), "2030-10-15");
  fireEvent.changeText(screen.getByLabelText("Hora de início (BRT)"), "08:00");
  fireEvent.changeText(screen.getByLabelText("Data de término"), "2030-10-22");
  fireEvent.changeText(screen.getByLabelText("Hora de término (BRT)"), "23:59");
  return { screen, onSaved };
}
describe("promotion screens", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2030-10-16T12:00:00.000Z"));
    jest.spyOn(api, "storePromotions").mockResolvedValue([]);
    jest.spyOn(api, "storeProducts").mockResolvedValue({ items: [product], total: 1, page: 1, limit: 20 });
    jest.spyOn(api, "productCategories").mockResolvedValue([]);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

  it("filters by effective state and product search", async () => {
    jest.mocked(api.storePromotions).mockResolvedValue([promotion, { ...promotion, id: "future", name: "Oferta cimento", product: { ...product, name: "Cimento" }, startsAt: "2031-01-01T00:00:00Z", endsAt: "2031-02-01T00:00:00Z" }, { ...promotion, id: "expired", endsAt: "2030-10-15T12:00:00Z" }]);
    const screen = render(<StorePromotionsScreen {...listProps} />);
    await screen.findByTestId("promotion-promo1");
    fireEvent.press(screen.getByLabelText("Agendadas"));
    expect(screen.getByTestId("promotion-future")).toBeTruthy();
    expect(screen.queryByTestId("promotion-promo1")).toBeNull();
    fireEvent.press(screen.getByLabelText("Todas"));
    fireEvent.changeText(screen.getByLabelText("Buscar promoções"), "cimento");
    expect(screen.getByTestId("promotion-future")).toBeTruthy(); expect(screen.queryByTestId("promotion-expired")).toBeNull();
  });
  it("removes active highlighting at expiry after refresh even if API status remains ACTIVE", async () => {
    jest.mocked(api.storePromotions).mockResolvedValue([promotion]);
    const screen = render(<StorePromotionsScreen {...listProps} />);
    await screen.findByText("Em vigor agora");
    expect(screen.getByText("−20% OFF")).toBeTruthy();
    jest.mocked(Date.now).mockReturnValue(Date.parse(promotion.endsAt!));
    await act(async () => fireEvent.press(screen.getByText("Atualizar promoções")));
    expect(screen.queryByText("Em vigor agora")).toBeNull(); expect(screen.queryByText("−20% OFF")).toBeNull();
    expect(screen.getByLabelText("Ativação de Oferta pisos").props.value).toBe(false);
    fireEvent.press(screen.getByLabelText("Vigentes")); expect(screen.queryByTestId("promotion-promo1")).toBeNull();
  });
  it("requires confirmation to deactivate and supports cancellation", async () => {
    jest.mocked(api.storePromotions).mockResolvedValue([promotion]);
    const change = jest.spyOn(api, "setStorePromotionStatus").mockResolvedValue({ ...promotion, status: "CANCELED" });
    const screen = render(<StorePromotionsScreen {...listProps} />);
    const toggle = await screen.findByLabelText("Ativação de Oferta pisos");
    fireEvent(toggle, "valueChange", false); expect(change).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Cancelar")); expect(change).not.toHaveBeenCalled();
    fireEvent(toggle, "valueChange", false);
    await act(async () => fireEvent.press(screen.getByLabelText("Desativar promoção")));
    expect(change).toHaveBeenCalledWith("promo1", "CANCELED");
  });
  it("requires confirmation to activate a saved draft", async () => {
    jest.mocked(api.storePromotions).mockResolvedValue([{ ...promotion, status: "DRAFT" }]);
    const change = jest.spyOn(api, "setStorePromotionStatus").mockResolvedValue(promotion);
    const screen = render(<StorePromotionsScreen {...listProps} />);
    fireEvent(await screen.findByLabelText("Ativação de Oferta pisos"), "valueChange", true);
    expect(change).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByLabelText("Ativar promoção")));
    expect(change).toHaveBeenCalledWith("promo1", "ACTIVE");
  });
  it("recovers from a list API error", async () => {
    jest.mocked(api.storePromotions).mockRejectedValueOnce(new ApiError("Servidor indisponível", 503)).mockResolvedValueOnce([promotion]);
    const screen = render(<StorePromotionsScreen {...listProps} />);
    await screen.findByText("Servidor indisponível"); fireEvent.press(screen.getByText("Tentar novamente"));
    expect(await screen.findByText("Em vigor agora")).toBeTruthy();
  });
  it("previews and publishes a single rule with dates in UTC after confirmation", async () => {
    const create = jest.spyOn(api, "createStorePromotion").mockResolvedValue(promotion);
    const { screen, onSaved } = await fillForm();
    expect(screen.getByTestId("promotion-final-price").props.children).toContain("71,92");
    fireEvent.press(screen.getByLabelText("Publicar")); expect(create).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByLabelText("Confirmar publicação")));
    expect(create).toHaveBeenCalledWith({ name: "Oferta pisos", productId: "p1", discountType: "PERCENTAGE", discountValue: 20, startsAt: promotion.startsAt, endsAt: promotion.endsAt, status: "ACTIVE" });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it("keeps publish disabled when fixing dates still leaves an invalid discount", async () => {
    const { screen } = await fillForm();
    fireEvent.changeText(screen.getByLabelText("Valor do desconto"), "100");
    fireEvent.changeText(screen.getByLabelText("Data de término"), "2030-10-14");
    expect(screen.getByLabelText("Publicar")).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Data de término"), "2030-10-22");
    expect(screen.getByLabelText("Publicar")).toBeDisabled(); expect(screen.queryByTestId("promotion-final-price")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Valor do desconto"), "20"); expect(screen.getByLabelText("Publicar")).not.toBeDisabled();
  });
  it("prevents publishing overlapping campaigns", async () => {
    jest.mocked(api.storePromotions).mockResolvedValue([promotion]);
    const { screen } = await fillForm();
    expect(screen.getByLabelText("Publicar")).toBeDisabled();
    expect(screen.getByText(/Já existe uma promoção/)).toBeTruthy();
    expect(screen.getByLabelText("Salvar rascunho")).not.toBeDisabled();
  });
  it("retains form values when publication fails and permits retry", async () => {
    const create = jest.spyOn(api, "createStorePromotion").mockRejectedValueOnce(new ApiError("Conflito detectado no servidor", 409)).mockResolvedValueOnce(promotion);
    const { screen, onSaved } = await fillForm();
    fireEvent.press(screen.getByLabelText("Publicar"));
    await act(async () => fireEvent.press(screen.getByLabelText("Confirmar publicação")));
    expect(await screen.findByText("Conflito detectado no servidor")).toBeTruthy();
    expect(screen.getByLabelText("Valor do desconto").props.value).toBe("20"); expect(onSaved).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Publicar"));
    await act(async () => fireEvent.press(screen.getByLabelText("Confirmar publicação")));
    expect(create).toHaveBeenCalledTimes(2); expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it("loads an existing promotion and saves its changes as draft", async () => {
    jest.spyOn(api, "storePromotion").mockResolvedValue(promotion);
    const update = jest.spyOn(api, "updateStorePromotion").mockResolvedValue({ ...promotion, status: "DRAFT" });
    const saved = jest.fn();
    const screen = render(<StorePromotionFormScreen id="promo1" onBack={jest.fn()} onSaved={saved} />);
    expect((await screen.findByLabelText("Nome da promoção")).props.value).toBe(promotion.name);
    fireEvent.press(screen.getByLabelText("Salvar rascunho"));
    await act(async () => fireEvent.press(screen.getByLabelText("Confirmar rascunho")));
    expect(update).toHaveBeenCalledWith("promo1", expect.objectContaining({ status: "DRAFT", discountValue: 20 })); expect(saved).toHaveBeenCalledTimes(1);
  });
  it("requires discard confirmation when changing only publication settings", async () => {
    jest.spyOn(api, "storePromotion").mockResolvedValue(promotion);
    const back = jest.fn();
    const screen = render(<StorePromotionFormScreen id="promo1" onBack={back} onSaved={jest.fn()} />);
    const toggle = await screen.findByLabelText("Publicar no período definido");
    fireEvent(toggle, "valueChange", false);
    fireEvent.press(screen.getByLabelText("Voltar")); expect(back).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Cancelar")); expect(back).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Voltar")); fireEvent.press(screen.getByLabelText("Descartar e voltar"));
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("navigates from dashboard to create, edit, catalog and back", async () => {
    jest.spyOn(api, "storeDashboard").mockResolvedValue({ hasStore: true, activeProducts: 1, lowStockProducts: 0, activePromotions: 1, unreadMessages: 0, ordersByStatus: {} });
    jest.spyOn(api, "storeIdentity").mockResolvedValue({ name: "Loja", status: "ACTIVE" });
    jest.mocked(api.storePromotions).mockResolvedValue([promotion]); jest.spyOn(api, "storePromotion").mockResolvedValue(promotion);
    const screen = render(<Flow />);
    fireEvent.press(await screen.findByLabelText("Promoções ativas: 1"));
    fireEvent.press(await screen.findByLabelText("Criar nova promoção"));
    await screen.findByLabelText("Selecionar produto"); fireEvent.press(screen.getByLabelText("Voltar"));
    fireEvent.press(await screen.findByLabelText("Editar Oferta pisos"));
    expect((await screen.findByLabelText("Nome da promoção")).props.value).toBe(promotion.name);
    fireEvent.press(screen.getByLabelText("Voltar"));
    fireEvent.press(await screen.findByLabelText("Produtos"));
    await screen.findByText("Catálogo da loja");
    fireEvent.press(screen.getByLabelText("Promoções"));
    await screen.findByText("Promoções e descontos");
    fireEvent.press(screen.getByLabelText("Voltar")); expect(await screen.findByText("Vitrine Loja")).toBeTruthy();
  });
});
