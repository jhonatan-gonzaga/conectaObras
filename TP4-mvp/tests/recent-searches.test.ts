import AsyncStorage from "@react-native-async-storage/async-storage";
import { recentSearches } from "../front-end/src/services/recent-searches";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

describe("persistent recent searches", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("normalizes, deduplicates and persists actual domain searches for each user", async () => {
    await recentSearches.record("user-a", { domain: "products", query: "  Cimento   50kg " });
    await recentSearches.record("user-a", { domain: "products", query: "cimento 50kg" });
    await recentSearches.record("user-a", { domain: "stores", query: "cimento 50kg" });
    expect(await recentSearches.load("user-a")).toEqual([{ domain: "stores", query: "cimento 50kg" }, { domain: "products", query: "cimento 50kg" }]);
    expect(await recentSearches.load("user-b")).toEqual([]);
    expect(await recentSearches.load()).toEqual([]);
    await recentSearches.record("guest", { domain: "stores", query: "Materiais" });
    expect(await recentSearches.load()).toEqual([]);
  });

  it("serializes pending recordings and deletion so deleted entries stay deleted on reload", async () => {
    const entry = { domain: "products" as const, query: "Tinta" };
    const record = recentSearches.record("a", entry);
    const remove = recentSearches.remove("a", entry);
    await Promise.all([record, remove]);
    expect(await recentSearches.load("a")).toEqual([]);
  });

  it("persists individual deletion and clear without affecting another user", async () => {
    const first = { domain: "products" as const, query: "Tinta" };
    const second = { domain: "professionals" as const, query: "Pintor" };
    await recentSearches.record("a", first); await recentSearches.record("a", second);
    await recentSearches.record("b", first);
    await recentSearches.remove("a", first);
    expect(await recentSearches.load("a")).toEqual([second]);
    await recentSearches.clear("a");
    expect(await recentSearches.load("a")).toEqual([]);
    expect(await recentSearches.load("b")).toEqual([first]);
  });

  it("limits history and ignores blank searches", async () => {
    for (let i = 0; i < 14; i++) await recentSearches.record("a", { domain: "stores", query: `Loja ${i}` });
    await recentSearches.record("a", { domain: "stores", query: " " });
    expect(await recentSearches.load("a")).toHaveLength(12);
  });
});
