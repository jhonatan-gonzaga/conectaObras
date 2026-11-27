import { act, renderHook } from "@testing-library/react-native";
import { useCatalogPage } from "../front-end/src/services/use-catalog-page";
import { useCatalogDetail } from "../front-end/src/services/use-catalog-detail";
import type { CatalogPage, ProductQuery } from "../front-end/src/services/public-catalog";

type Item = { id: string };
const page = (ids: string[], number = 1, total = ids.length): CatalogPage<Item> => ({ items: ids.map((id) => ({ id })), page: number, total, limit: 2 });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { await act(async () => { jest.advanceTimersByTime(350); }); };

describe("catalog debounce and pagination", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("debounces combined filter edits and never sends each character", async () => {
    const fetchPage = jest.fn().mockResolvedValue(page([]));
    const hook = renderHook(({ q, categoryId }) => useCatalogPage<Item, ProductQuery>(fetchPage, { q, categoryId }), { initialProps: { q: "", categoryId: "" } });
    hook.rerender({ q: "c", categoryId: "" });
    act(() => jest.advanceTimersByTime(200));
    hook.rerender({ q: "cimento", categoryId: "real-id" });
    act(() => jest.advanceTimersByTime(349));
    expect(fetchPage).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ q: "cimento", categoryId: "real-id", page: 1 });
  });

  it("ignores obsolete responses during debounce and after newer results", async () => {
    const old = deferred<CatalogPage<Item>>();
    const fetchPage = jest.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(page(["new"]));
    const hook = renderHook(({ q }) => useCatalogPage<Item, ProductQuery>(fetchPage, { q }), { initialProps: { q: "old" } });
    await tick();
    hook.rerender({ q: "new" });
    await tick();
    expect(hook.result.current.items).toEqual([{ id: "new" }]);
    await act(async () => { old.resolve(page(["obsolete"])); });
    expect(hook.result.current.items).toEqual([{ id: "new" }]);
  });

  it("deduplicates pages, locks simultaneous loads, stops at the end and resets filters", async () => {
    const second = deferred<CatalogPage<Item>>();
    const fetchPage = jest.fn().mockResolvedValueOnce(page(["a", "b"], 1, 4)).mockReturnValueOnce(second.promise).mockResolvedValueOnce(page(["filtered"]));
    const hook = renderHook(({ q }) => useCatalogPage<Item, ProductQuery>(fetchPage, { q, limit: 2 }), { initialProps: { q: "" } });
    await tick();
    act(() => { hook.result.current.loadMore(); hook.result.current.loadMore(); });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve(page(["b", "c"], 2, 4)); });
    expect(hook.result.current.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    act(() => hook.result.current.loadMore());
    expect(fetchPage).toHaveBeenCalledTimes(2);
    hook.rerender({ q: "filtered" });
    expect(hook.result.current.items).toEqual([]);
    await tick();
    expect(fetchPage).toHaveBeenLastCalledWith({ q: "filtered", limit: 2, page: 1 });
    expect(hook.result.current.items).toEqual([{ id: "filtered" }]);
  });

  it("does not mix a pending next page with new filters", async () => {
    const second = deferred<CatalogPage<Item>>();
    const fetchPage = jest.fn().mockResolvedValueOnce(page(["a", "b"], 1, 4)).mockReturnValueOnce(second.promise).mockResolvedValueOnce(page(["new-filter"]));
    const hook = renderHook(({ q }) => useCatalogPage<Item, ProductQuery>(fetchPage, { q }), { initialProps: { q: "old" } });
    await tick(); act(() => hook.result.current.loadMore());
    hook.rerender({ q: "new" }); await tick();
    await act(async () => { second.resolve(page(["old-page-2"], 2, 4)); });
    expect(hook.result.current.items).toEqual([{ id: "new-filter" }]);
  });

  it("retries the failed next page without dropping previous results", async () => {
    const fetchPage = jest.fn().mockResolvedValueOnce(page(["a", "b"], 1, 3)).mockRejectedValueOnce(new Error("Sem rede")).mockResolvedValueOnce(page(["c"], 2, 3));
    const hook = renderHook(() => useCatalogPage<Item, ProductQuery>(fetchPage, {}));
    await tick();
    await act(async () => { hook.result.current.loadMore(); });
    expect(hook.result.current.error).toBe("Sem rede");
    expect(hook.result.current.items).toHaveLength(2);
    await act(async () => { hook.result.current.retry(); });
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 2 });
    expect(hook.result.current.items).toHaveLength(3);
    expect(hook.result.current.error).toBeNull();
  });

  it("discards old detail IDs even when they resolve after the new detail", async () => {
    const old = deferred<Item>();
    const fetch = jest.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce({ id: "new-id" });
    const hook = renderHook(({ id }) => useCatalogDetail(fetch, id), { initialProps: { id: "old-id" } });
    hook.rerender({ id: "new-id" });
    await act(async () => {});
    await act(async () => old.resolve({ id: "old-id" }));
    expect(hook.result.current.data).toEqual({ id: "new-id" });
  });
});
