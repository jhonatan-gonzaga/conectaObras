import { api, ApiError, setAccessToken } from "../front-end/src/services/api";
import { catalogPriceError, formatCatalogPrice } from "../front-end/src/services/public-catalog";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn().mockResolvedValue(undefined), deleteItemAsync: jest.fn().mockResolvedValue(undefined) }));

describe("public catalog HTTP contracts", () => {
  afterEach(() => jest.restoreAllMocks());
  const response = { ok: true, status: 200, text: async () => JSON.stringify({ items: [], total: 0, page: 1, limit: 20 }) } as Response;

  it.each([
    { q: "cimento & areia" }, { city: "Itacoatiara" }, { neighborhood: "Centro" }, { openNow: false },
    { q: "material", city: "Itacoatiara", neighborhood: "Centro", openNow: true, page: 2, limit: 10 },
  ])("serializes individual/combined store filters %j", async (filters) => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue(response);
    await setAccessToken("private-token");
    await api.publicStores(filters);
    const [url, options] = fetch.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/api/stores");
    Object.entries(filters).forEach(([key, value]) => expect(parsed.searchParams.get(key)).toBe(String(value)));
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
  });

  it.each([
    { q: "tinta" }, { categoryId: "real-category" }, { storeId: "real-store" }, { minPrice: "0.00" },
    { maxPrice: "99999999.99" }, { inStock: false }, { onPromotion: false },
    { q: "cimento", categoryId: "cat-1", storeId: "store-1", minPrice: "1.20", maxPrice: "50.10", inStock: true, onPromotion: true, page: 3, limit: 20 },
  ])("serializes individual/combined product filters %j", async (filters) => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue(response);
    await api.publicProducts(filters);
    const parsed = new URL(String(fetch.mock.calls[0][0]));
    expect(parsed.pathname).toBe("/api/products");
    Object.entries(filters).forEach(([key, value]) => expect(parsed.searchParams.get(key)).toBe(String(value)));
  });

  it("encodes real IDs and keeps 404 errors", async () => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue(response);
    await api.publicStore("store/id"); await api.publicProduct("product id");
    expect(fetch.mock.calls[0][0]).toContain("/stores/store%2Fid");
    expect(fetch.mock.calls[1][0]).toContain("/products/product%20id");
    fetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => JSON.stringify({ message: "Produto nao encontrado." }) } as Response);
    await expect(api.publicProduct("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("preserves decimal strings and validates price ranges", () => {
    expect(formatCatalogPrice("99999999.99")).toBe("R$ 99.999.999,99");
    expect(formatCatalogPrice("19.90")).toBe("R$ 19,90");
    expect(formatCatalogPrice("0.01")).toBe("R$ 0,01");
    expect(catalogPriceError("1,50", "2.00")).toBeNull();
    expect(catalogPriceError("3", "2")).toContain("mínimo");
    expect(catalogPriceError("1.999", "")).toContain("duas casas");
    expect(catalogPriceError("-1", "")).not.toBeNull();
  });
});
