import { useEffect, useRef, useState } from "react";
import type { CatalogPage } from "./public-catalog";

type Query = { page?: number; limit?: number };
type PageState<T> = { key: string; items: T[]; total: number; page: number; limit: number; loading: boolean; error: string | null; hasMore: boolean };

export function useCatalogPage<T extends { id: string }, Q extends Query>(
  fetchPage: (query: Q) => Promise<CatalogPage<T>>,
  filters: Q,
  enabled = true,
) {
  const key = JSON.stringify(filters);
  const currentKey = useRef(key);
  currentKey.current = key;
  const active = useRef(enabled);
  active.current = enabled;
  const generation = useRef(0);
  const inFlight = useRef(false);
  const failedPage = useRef(1);
  const [state, setState] = useState<PageState<T>>({ key: "", items: [], total: 0, page: 0, limit: 20, loading: true, error: null, hasMore: false });
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = async (page: number, requestKey: string, epoch: number) => {
    if (inFlight.current || !active.current || requestKey !== currentKey.current) return;
    inFlight.current = true;
    failedPage.current = page;
    setState((previous) => ({ ...previous, key: requestKey, loading: true, error: null }));
    try {
      const result = await fetchPage({ ...JSON.parse(requestKey), page });
      if (epoch !== generation.current || requestKey !== currentKey.current || !active.current) return;
      setState((previous) => {
        const combined = page === 1 ? result.items : [...previous.items, ...result.items];
        const items = [...new Map(combined.map((item) => [item.id, item])).values()];
        return { key: requestKey, items, total: result.total, page: result.page, limit: result.limit,
          loading: false, error: null, hasMore: result.items.length > 0 && result.page * result.limit < result.total };
      });
    } catch (error) {
      if (epoch === generation.current && requestKey === currentKey.current && active.current) {
        setState((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : "Não foi possível carregar o catálogo." }));
      }
    } finally {
      if (epoch === generation.current) inFlight.current = false;
    }
  };
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const epoch = ++generation.current;
    inFlight.current = false;
    setState({ key, items: [], total: 0, page: 0, limit: filters.limit ?? 20, loading: enabled, error: null, hasMore: false });
    if (!enabled) return;
    const timer = setTimeout(() => { void loadRef.current(1, key, epoch); }, 350);
    return () => { clearTimeout(timer); generation.current++; inFlight.current = false; };
  }, [key, enabled]);

  const visible = state.key === key ? state : { ...state, items: [], total: 0, page: 0, loading: enabled, error: null, hasMore: false };
  return { ...visible,
    loadMore: () => {
      const latest = stateRef.current;
      if (latest.key === key && latest.hasMore && !latest.loading && !latest.error) void loadRef.current(latest.page + 1, key, generation.current);
    },
    retry: () => { void loadRef.current(failedPage.current, key, generation.current); },
  };
}
