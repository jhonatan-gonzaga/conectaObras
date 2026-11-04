import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../front-end/src/services/api";
import { cartStorageKey, cartTotal, centsAsDecimal, priceInCents, useCommerceCart } from "../front-end/src/services/commerce-cart";
import { publicProduct } from "./catalog-fixtures";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

describe("consumer cart", () => {
  beforeEach(async () => { await AsyncStorage.clear(); jest.spyOn(api, "publicProduct").mockResolvedValue(publicProduct); });
  afterEach(() => jest.restoreAllMocks());
  async function setup(userId = "client-a") {
    const hook = renderHook(() => useCommerceCart(userId));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    return hook;
  }

  it("keeps decimal prices exact, including zero, and rejects malformed prices", () => {
    expect(priceInCents("0.10")).toBe(10);
    expect(priceInCents("0")).toBe(0);
    expect(priceInCents("9.9")).toBe(990);
    expect(priceInCents("1.999")).toBeNull();
    expect(priceInCents("-1.00")).toBeNull();
    expect(centsAsDecimal(32790)).toBe("327.90");
    expect(cartTotal([{ id: "a", quantity: 3, product: { ...publicProduct, effectivePrice: "0.10" } }, { id: "b", quantity: 1, product: { ...publicProduct, effectivePrice: "0.20" } }])).toBe(50n);
  });

  it("adds real IDs, merges quantities and persists only IDs and quantities", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.add(publicProduct.id); });
    await act(async () => { await result.current.add(publicProduct.id); });
    expect(api.publicProduct).toHaveBeenCalledWith(publicProduct.id);
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.count).toBe(2);
    expect(result.current.total).toBe(7780n);
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(cartStorageKey("client-a")))!)).toEqual([{ id: publicProduct.id, quantity: 2 }]));
  });

  it("keeps totals exact across the backend's entire price and stock range", () => {
    const total = cartTotal([{ id: publicProduct.id, quantity: 2147483647, product: { ...publicProduct, effectivePrice: "99999999.99" } }]);
    expect(centsAsDecimal(total)).toBe("214748364678525163.53");
  });

  it("revalidates prices and stock on restore and clamps decreased stock", async () => {
    await AsyncStorage.setItem(cartStorageKey("client-a"), JSON.stringify([{ id: publicProduct.id, quantity: 10 }]));
    jest.spyOn(api, "publicProduct").mockResolvedValue({ ...publicProduct, stock: 2, effectivePrice: "50.00", onPromotion: false });
    const { result } = await setup();
    expect(result.current.lines[0].quantity).toBe(2);
    expect(result.current.total).toBe(10000n);
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid quantity %s without an API call", async (quantity) => {
    const { result } = await setup();
    await act(async () => { await result.current.setQuantity(publicProduct.id, quantity); });
    expect(api.publicProduct).not.toHaveBeenCalled();
    expect(result.current.lines).toEqual([]);
    expect(result.current.error).toMatch(/quantidade inteira/);
  });

  it("blocks overselling and adjusts an existing line to newly confirmed stock", async () => {
    const { result } = await setup();
    await act(async () => { await result.current.setQuantity(publicProduct.id, 3); });
    jest.spyOn(api, "publicProduct").mockResolvedValue({ ...publicProduct, stock: 1 });
    await act(async () => { await result.current.add(publicProduct.id); });
    expect(result.current.lines[0].quantity).toBe(1);
    expect(result.current.error).toBe("Estoque disponível: 1 unidades.");
    expect(result.current.total).toBe(3890n);
  });

  it("excludes unavailable products from totals and allows removal", async () => {
    await AsyncStorage.setItem(cartStorageKey("client-a"), JSON.stringify([{ id: publicProduct.id, quantity: 2 }]));
    jest.spyOn(api, "publicProduct").mockResolvedValue({ ...publicProduct, stock: 0, inStock: false });
    const { result } = await setup();
    expect(result.current.lines[0].product).toBeNull();
    expect(result.current.total).toBe(0n);
    act(() => result.current.remove(publicProduct.id));
    expect(result.current.lines).toEqual([]);
  });

  it("keeps failed items removable, shows errors and retries hydration", async () => {
    await AsyncStorage.setItem(cartStorageKey("client-a"), JSON.stringify([{ id: publicProduct.id, quantity: 2 }]));
    jest.spyOn(api, "publicProduct").mockRejectedValueOnce(new Error("Sem rede")).mockResolvedValue(publicProduct);
    const { result } = await setup();
    expect(result.current.error).toMatch(/não puderam ser consultados/);
    expect(result.current.total).toBe(0n);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.total).toBe(7780n));
    expect(result.current.error).toBeNull();
  });

  it("blocks a product returned under a different ID", async () => {
    jest.spyOn(api, "publicProduct").mockResolvedValue({ ...publicProduct, id: "different-id" });
    const { result } = await setup();
    await act(async () => { await result.current.add(publicProduct.id); });
    expect(result.current.lines).toEqual([]);
    expect(result.current.error).toMatch(/confirmar o produto/);
  });

  it("deduplicates stored IDs and ignores corrupt quantities", async () => {
    await AsyncStorage.setItem(cartStorageKey("client-a"), JSON.stringify([{ id: publicProduct.id, quantity: 1 }, { id: publicProduct.id, quantity: 2 }, { id: "bad", quantity: -2 }]));
    const { result } = await setup();
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.count).toBe(2);
  });

  it("locks repeated taps while a stock request is pending", async () => {
    let resolve!: (value: typeof publicProduct) => void;
    jest.spyOn(api, "publicProduct").mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = await setup();
    act(() => { void result.current.add(publicProduct.id); void result.current.add(publicProduct.id); });
    expect(api.publicProduct).toHaveBeenCalledTimes(1);
    await act(async () => resolve(publicProduct));
    expect(result.current.count).toBe(1);
  });

  it("isolates users and discards pending responses from the previous account", async () => {
    let resolve!: (value: typeof publicProduct) => void;
    jest.spyOn(api, "publicProduct").mockReturnValue(new Promise((done) => { resolve = done; }));
    const hook = renderHook(({ user }) => useCommerceCart(user), { initialProps: { user: "client-a" } });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    act(() => { void hook.result.current.add(publicProduct.id); });
    hook.rerender({ user: "client-b" });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await act(async () => resolve(publicProduct));
    expect(hook.result.current.lines).toEqual([]);
    expect(await AsyncStorage.getItem(cartStorageKey("client-a"))).toBe("[]");
  });

  it("does not overwrite storage after a failed read", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("Storage failure"));
    const { result } = renderHook(() => useCommerceCart("client-a"));
    await waitFor(() => expect(result.current.error).toMatch(/ler o carrinho/));
    expect(result.current.ready).toBe(false);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.ready).toBe(true));
  });
});
