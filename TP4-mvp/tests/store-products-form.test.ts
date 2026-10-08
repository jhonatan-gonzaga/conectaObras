import { emptyProductForm, inventoryPayload, parseProductPrice, parseProductStock, productPayload, validateProductForm, type StoreProduct } from "../front-end/src/services/store-products";

const saved = { id: "p", price: "29.90", stock: 3, status: "ACTIVE" } as StoreProduct;

describe("product form validation", () => {
  it("normalizes Brazilian prices into decimal strings without floats", () => {
    expect(parseProductPrice(" 29,9 ")).toBe("29.90");
    expect(parseProductPrice("0,01")).toBe("0.01");
    for (const value of ["0", "-1", "abc", "1,234", "1e2", "100000000", ""]) expect(parseProductPrice(value)).toBeNull();
  });

  it("requires an integer stock within the database range", () => {
    expect(parseProductStock("0")).toBe(0);
    expect(parseProductStock("23")).toBe(23);
    for (const value of ["-1", "2.5", "2,5", "abc", "2147483648", ""]) expect(parseProductStock(value)).toBeNull();
  });

  it("validates required fields and builds create/edit payloads", () => {
    expect(Object.keys(validateProductForm(emptyProductForm())).sort()).toEqual(["categoryId", "name", "price", "stock"]);
    const form = { ...emptyProductForm(), name: "  Furadeira  ", categoryId: "tools", price: "29,90", stock: "0", sku: " FUR-01 ", description: "  710W " };
    expect(validateProductForm(form)).toEqual({});
    expect(productPayload(form)).toEqual({ name: "Furadeira", categoryId: "tools", price: "29.90", stock: 0, sku: "FUR-01", description: "710W" });
  });

  it("validates quick edits and only sends changed values", () => {
    expect(inventoryPayload("29,90", "3", saved)).toEqual({ errors: {}, payload: {} });
    expect(inventoryPayload("30,00", "0", saved)).toEqual({ errors: {}, payload: { price: "30.00", stock: 0 } });
    expect(inventoryPayload("abc", "-1", saved)).toMatchObject({ payload: null, errors: { price: expect.any(String), stock: expect.any(String) } });
  });
});
