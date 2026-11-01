import { useState } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { api, ApiError, type ProfessionalProfile } from "../front-end/src/services/api";
import { ClientProductDetailPage, ClientStoreDetailPage } from "../front-end/src/pages/cliente/catalog";
import { ProductCatalog, StoreCatalog } from "../front-end/src/components/cliente/catalog-results";
import { CatalogImage } from "../front-end/src/components/cliente/catalog-ui";
import { ClientSearchPage } from "../front-end/src/pages/cliente/search";
import { ClientHomePage } from "../front-end/src/pages/cliente/home";
import { recentSearches } from "../front-end/src/services/recent-searches";
import type { ProductQuery, StoreQuery } from "../front-end/src/services/public-catalog";
import { publicProduct, publicStore } from "./catalog-fixtures";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

describe("customer commercial screens", () => {
  beforeEach(() => {
    jest.spyOn(api, "me").mockResolvedValue({ id: "user-a", name: "Cliente" } as never);
    jest.spyOn(api, "myServiceAdsSummary").mockResolvedValue({ receivedApplications: 0 } as never);
    jest.spyOn(api, "unreadConversations").mockResolvedValue({ count: 0 });
    jest.spyOn(api, "productCategories").mockResolvedValue([publicProduct.category]);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it("keeps the works home dedicated to services without commercial content or requests", async () => {
    jest.useFakeTimers();
    const categories = [{ id: "paint", name: "Pintura" }, { id: "brick", name: "Alvenaria" }];
    const professionals: ProfessionalProfile[] = categories.map((category, index) => ({
      id: `professional-${index}`,
      user: { id: `user-${index}`, name: index === 0 ? "Ana pintora" : "Bruno pedreiro", role: "PROFISSIONAL" },
      specialties: [{ category }], dailyRate: "200.00", ratingAvg: "4.8",
      servicesDone: 3, availability: [], portfolio: [],
    }));
    const serviceCategories = jest.spyOn(api, "categories").mockResolvedValue(categories);
    const serviceProfessionals = jest.spyOn(api, "professionals").mockResolvedValue({ items: professionals, total: 2, page: 1, limit: 20 });
    const stores = jest.spyOn(api, "publicStores").mockResolvedValue({ items: [publicStore], total: 1, page: 1, limit: 3 });
    const products = jest.spyOn(api, "publicProducts").mockResolvedValue({ items: [publicProduct], total: 1, page: 1, limit: 4 });
    const store = jest.spyOn(api, "publicStore");
    const product = jest.spyOn(api, "publicProduct");
    const onOpenProfessional = jest.fn(), onNavigate = jest.fn();
    const screen = render(<ClientHomePage onOpenProfessional={onOpenProfessional} onNavigate={onNavigate} />);
    await act(async () => jest.advanceTimersByTime(350));

    expect(screen.getByText("Ana pintora")).toBeTruthy();
    expect(screen.getByText("Bruno pedreiro")).toBeTruthy();
    expect(screen.getByLabelText("Conecta Obras Itacoatiara")).toBeTruthy();
    expect(screen.getByText("O que você precisa hoje?")).toBeTruthy();
    expect(screen.getByLabelText("Buscar servicos ou profissionais")).toBeTruthy();
    expect(screen.getByText("Profissionais em destaque")).toBeTruthy();
    expect(screen.getByText("Categorias")).toBeTruthy();
    for (const label of ["Lojas de materiais", "Catálogo de produtos", "Ofertas e promoções", "Ver todas as promoções", "Ver todas as lojas"]) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
    expect(screen.queryByText(/Produtos em promoção|Nenhuma promoção disponível|Lojas e materiais|Materiais e insumos|Ver catálogo/)).toBeNull();
    expect(screen.queryByText(publicProduct.name)).toBeNull();
    expect(screen.queryByText(publicStore.name!)).toBeNull();
    for (const label of ["Inicio", "Obra", "Buscar", "Anunciar", "Ajustes"]) {
      fireEvent.press(screen.getByLabelText(label));
    }
    expect(onNavigate.mock.calls).toEqual([["home"], ["work"], ["search"], ["ads"], ["settings"]]);
    fireEvent.press(screen.getByText("Ana pintora"));
    expect(onOpenProfessional).toHaveBeenCalledWith("professional-0");

    const search = screen.getByLabelText("Buscar servicos ou profissionais");
    fireEvent.changeText(search, "Bruno");
    await act(async () => jest.advanceTimersByTime(350));
    expect(screen.queryByText("Ana pintora")).toBeNull();
    expect(screen.getByText("Bruno pedreiro")).toBeTruthy();
    fireEvent.changeText(search, "Pintura");
    await act(async () => jest.advanceTimersByTime(350));
    expect(screen.getByText("Ana pintora")).toBeTruthy();
    expect(screen.queryByText("Bruno pedreiro")).toBeNull();
    fireEvent.changeText(search, "");
    await act(async () => jest.advanceTimersByTime(350));
    fireEvent.press(screen.getAllByRole("button", { name: "Alvenaria" })[0]);
    expect(screen.getByText("Profissionais: Alvenaria")).toBeTruthy();
    expect(screen.queryByText("Ana pintora")).toBeNull();
    fireEvent.press(screen.getByLabelText("Limpar categoria"));
    expect(screen.getByText("Ana pintora")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Filtros"));
    expect(screen.getByText("Faixa de Preco (por dia)")).toBeTruthy();

    expect(serviceCategories).toHaveBeenCalledTimes(1);
    expect(serviceProfessionals).toHaveBeenCalledTimes(1);
    for (const commercialRequest of [api.productCategories, stores, products, store, product]) {
      expect(commercialRequest).not.toHaveBeenCalled();
    }
  });

  it("combines store filters after debounce and opens the exact store ID", async () => {
    jest.useFakeTimers();
    const fetch = jest.spyOn(api, "publicStores").mockResolvedValue({ items: [publicStore], total: 1, page: 1, limit: 20 });
    const open = jest.fn();
    function Screen() { const [filters, setFilters] = useState<StoreQuery>({}); return <StoreCatalog filters={filters} onChange={setFilters} onStore={open} />; }
    const screen = render(<Screen />);
    expect(screen.getByLabelText("Aberto agora").props.value).toBe(false);
    fireEvent.changeText(screen.getByLabelText("Buscar lojas"), "Materiais");
    expect(screen.queryByLabelText("Cidade")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Bairro"), "Centro");
    fireEvent(screen.getByLabelText("Aberto agora"), "valueChange", true);
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(350));
    expect(fetch).toHaveBeenLastCalledWith({ q: "Materiais", neighborhood: "Centro", openNow: true, page: 1 });
    fireEvent.press(screen.getByLabelText(`Ver loja ${publicStore.name}`));
    expect(open).toHaveBeenCalledWith(publicStore.id);
    expect(screen.getByText("Mostrando 1 de 1 resultados")).toBeTruthy();
  });

  it("uses real category IDs, decimal prices, availability and promotion filters", async () => {
    jest.useFakeTimers();
    const fetch = jest.spyOn(api, "publicProducts").mockResolvedValue({ items: [publicProduct], total: 1, page: 1, limit: 20 });
    const open = jest.fn();
    function Screen() { const [filters, setFilters] = useState<ProductQuery>({}); return <ProductCatalog filters={filters} onChange={setFilters} onProduct={open} />; }
    const screen = render(<Screen />);
    await act(async () => {});
    fireEvent.press(screen.getByLabelText(publicProduct.category.name));
    fireEvent.changeText(screen.getByLabelText("Preço mínimo (R$)"), "10,25");
    fireEvent.changeText(screen.getByLabelText("Preço máximo (R$)"), "50,90");
    fireEvent(screen.getByLabelText("Somente em estoque"), "valueChange", true);
    fireEvent(screen.getByLabelText("Com promoção vigente"), "valueChange", true);
    await act(async () => jest.advanceTimersByTime(350));
    expect(fetch).toHaveBeenLastCalledWith({ categoryId: "category-real-12", minPrice: "10.25", maxPrice: "50.90", inStock: true, onPromotion: true, page: 1 });
    fireEvent.press(screen.getByLabelText(`Ver produto ${publicProduct.name}`));
    expect(open).toHaveBeenCalledWith(publicProduct.id);
    fireEvent.changeText(screen.getByLabelText("Preço mínimo (R$)"), "90");
    await act(async () => jest.advanceTimersByTime(350));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/mínimo não pode/)).toBeTruthy();
  });

  it("renders loading, empty, network failure and retry", async () => {
    jest.useFakeTimers();
    const fetch = jest.spyOn(api, "publicStores").mockRejectedValueOnce(new Error("Sem rede")).mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 20 });
    const screen = render(<StoreCatalog filters={{}} onChange={jest.fn()} onStore={jest.fn()} />);
    expect(screen.getByLabelText("Carregando catálogo")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(350));
    expect(screen.getByText("Sem rede")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText("Tentar novamente")));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Nenhuma loja encontrada/)).toBeTruthy();
  });

  it("loads the store, ordered hours, active promotions and its own product catalog", async () => {
    jest.useFakeTimers();
    const store = jest.spyOn(api, "publicStore").mockResolvedValue(publicStore);
    const products = jest.spyOn(api, "publicProducts").mockResolvedValue({ items: [publicProduct], total: 1, page: 1, limit: 20 });
    const openProduct = jest.fn();
    const screen = render(<ClientStoreDetailPage id={publicStore.id} onProduct={openProduct} onBack={jest.fn()} />);
    await act(async () => {});
    await act(async () => jest.advanceTimersByTime(350));
    expect(store).toHaveBeenCalledWith(publicStore.id);
    expect(products).toHaveBeenCalledWith({ storeId: publicStore.id, page: 1 });
    const text = screen.getAllByText(/^(Domingo|Segunda-feira):/).map((node) => node.props.children.join(""));
    expect(text[0]).toContain("Domingo");
    expect(screen.getByText("Segunda-feira: 07:30 – 18:00")).toBeTruthy();
    fireEvent.press(screen.getByLabelText(`Ver oferta ${publicProduct.name}`));
    fireEvent.press(screen.getByLabelText(`Ver produto ${publicProduct.name}`));
    expect(openProduct.mock.calls).toEqual([[publicProduct.id], [publicProduct.id]]);
    expect(screen.queryByText(/avaliações|Entrega rápida|km de/)).toBeNull();
  });

  it("refuses products from a different store even if the API returns them", async () => {
    jest.useFakeTimers();
    jest.spyOn(api, "publicStore").mockResolvedValue(publicStore);
    jest.spyOn(api, "publicProducts").mockResolvedValue({ items: [{ ...publicProduct, store: { ...publicStore, id: "other-store" } }], total: 1, page: 1, limit: 20 });
    const screen = render(<ClientStoreDetailPage id={publicStore.id} onProduct={jest.fn()} onBack={jest.fn()} />);
    await act(async () => {});
    await act(async () => jest.advanceTimersByTime(350));
    expect(screen.getByText(/confirmar os produtos desta loja/)).toBeTruthy();
    expect(screen.queryByLabelText(`Ver produto ${publicProduct.name}`)).toBeNull();
  });

  it("shows API prices and real store navigation in product details without a purchase flow", async () => {
    jest.spyOn(api, "publicProduct").mockResolvedValue(publicProduct);
    const openStore = jest.fn();
    const screen = render(<ClientProductDetailPage id={publicProduct.id} onStore={openStore} onBack={jest.fn()} />);
    expect(await screen.findByText("R$ 38,90")).toBeTruthy();
    expect(screen.getByText("R$ 44,90")).toBeTruthy();
    expect(screen.getByText("Disponível em estoque (48 unidades)")).toBeTruthy();
    expect(screen.getByText("Imagem indisponível")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Ver loja e outros produtos"));
    expect(openStore).toHaveBeenCalledWith(publicStore.id);
    expect(screen.queryByText(/Comprar|Reservar|13%/)).toBeNull();
  });

  it("shows unavailable stock and no invented description or image", async () => {
    jest.spyOn(api, "publicProduct").mockResolvedValue({ ...publicProduct, stock: 0, inStock: false, onPromotion: false, promotion: null, effectivePrice: "44.90", description: null });
    const screen = render(<ClientProductDetailPage id={publicProduct.id} onStore={jest.fn()} onBack={jest.fn()} />);
    expect(await screen.findByText("Produto sem estoque")).toBeTruthy();
    expect(screen.getByText("Descrição não informada.")).toBeTruthy();
    expect(screen.queryByText("Promoção vigente")).toBeNull();
  });

  it.each(["store", "product"] as const)("handles a %s detail 404", async (kind) => {
    jest.spyOn(api, kind === "store" ? "publicStore" : "publicProduct").mockRejectedValue(new ApiError("Inexistente", 404));
    const screen = kind === "store" ? render(<ClientStoreDetailPage id="missing" onProduct={jest.fn()} onBack={jest.fn()} />) : render(<ClientProductDetailPage id="missing" onStore={jest.fn()} onBack={jest.fn()} />);
    expect(await screen.findByText(/indisponível/)).toBeTruthy();
    expect(screen.queryByText("Tentar novamente")).toBeNull();
  });

  it("retries product detail network errors", async () => {
    jest.spyOn(api, "publicProduct").mockRejectedValueOnce(new Error("Falha de rede")).mockResolvedValueOnce(publicProduct);
    const screen = render(<ClientProductDetailPage id="id" onStore={jest.fn()} onBack={jest.fn()} />);
    await screen.findByText("Falha de rede");
    fireEvent.press(screen.getByLabelText("Tentar novamente"));
    expect(await screen.findByText(publicProduct.name)).toBeTruthy();
  });

  it("falls back when the API image URL fails", () => {
    const screen = render(<CatalogImage uri="/uploads/missing.jpg" label="Material" />);
    fireEvent(screen.getByLabelText("Material"), "error");
    expect(screen.getByText("Imagem indisponível")).toBeTruthy();
  });

  it("preserves professional search, separates domains and reuses/deletes persistent history", async () => {
    await AsyncStorage.clear();
    await recentSearches.record("user-a", { domain: "products", query: "Cimento" });
    jest.useFakeTimers();
    const professionals = jest.spyOn(api, "professionals").mockResolvedValue({ items: [{ id: "pro-id", user: { name: "Ana profissional" }, specialties: [{ category: { id: "paint", name: "Pintor" } }], dailyRate: "200.00", ratingAvg: "4.8" }], total: 1, page: 1, limit: 20 } as never);
    jest.spyOn(api, "categories").mockResolvedValue([{ id: "paint", name: "Pintor" }] as never);
    const products = jest.spyOn(api, "publicProducts").mockResolvedValue({ items: [publicProduct], total: 1, page: 1, limit: 20 });
    const openPro = jest.fn();
    const screen = render(<ClientSearchPage userId="user-a" onOpenProfessional={openPro} />);
    await act(async () => {});
    expect(screen.getByText("Ana profissional")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Buscar servicos ou profissionais"), "Pintura");
    await act(async () => jest.advanceTimersByTime(350));
    expect(screen.getByText("Ana profissional")).toBeTruthy();
    fireEvent.press(screen.getByText("Ana profissional"));
    expect(openPro).toHaveBeenCalledWith("pro-id");
    fireEvent.press(screen.getByLabelText("Repetir busca Cimento"));
    await act(async () => jest.advanceTimersByTime(350));
    expect(products).toHaveBeenLastCalledWith({ q: "Cimento", page: 1 });
    expect(screen.queryByText("Faixa de Preco (por dia)")).toBeNull();
    expect(professionals).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(screen.getByLabelText("Excluir busca Cimento")));
    expect((await recentSearches.load("user-a")).some((entry) => entry.query === "Cimento")).toBe(false);
    await act(async () => fireEvent.press(screen.getByLabelText("Limpar histórico")));
    expect(await recentSearches.load("user-a")).toEqual([]);
    expect(screen.queryByText("Mais Proximo")).toBeNull();
  });
});
