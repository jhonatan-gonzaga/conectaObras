import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { ApiError, api, type Paginated, type StoreOrder, type StoreOrdersFilters, type StoreOrderStatus } from "../../services/api";

export type OrdersAudience = "owner" | "client";
const errorMessage = (cause: unknown) => cause instanceof ApiError ? cause.message : "Não foi possível carregar os pedidos. Tente novamente.";

export function useOrders(audience: OrdersAudience, initialStatus?: StoreOrderStatus) {
  const [filters, setFilters] = useState<StoreOrdersFilters>({
    status: initialStatus, group: audience === "client" ? "OPEN" : undefined, page: 1, limit: 10,
  });
  const [data, setData] = useState<Paginated<StoreOrder>>({ items: [], total: 0, page: 1, limit: 10 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailValid, setDetailValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const inFlight = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current++; };
  }, []);

  const refresh = useCallback(async (foreground = false, afterMutation = false) => {
    if (busy.current && !afterMutation) return false;
    if (!foreground && !afterMutation && inFlight.current) return false;
    const version = ++request.current;
    inFlight.current = true;
    if (foreground) setLoading(true);
    try {
      const [page, detail] = await Promise.all([
        audience === "owner" ? api.storeOrdersPage(filters) : api.clientStoreOrders(filters),
        selectedId ? (audience === "owner" ? api.storeOrder(selectedId) : api.clientStoreOrder(selectedId)) : Promise.resolve(null),
      ]);
      if (!mounted.current || version !== request.current) return false;
      // A status change can remove the last item of the current page.
      const lastPage = Math.max(1, Math.ceil(page.total / page.limit));
      if (page.page > lastPage) {
        setFilters((current) => ({ ...current, page: lastPage }));
      }
      setData(page);
      setSelected(detail);
      setDetailValid(!!detail);
      setError(null);
      return true;
    } catch (cause) {
      if (mounted.current && version === request.current) {
        setError(errorMessage(cause));
        setDetailValid(false);
      }
      return false;
    } finally {
      if (mounted.current && version === request.current) { setLoading(false); inFlight.current = false; }
    }
  }, [audience, filters, selectedId]);

  useEffect(() => {
    void refresh(true);
    const timer = setInterval(() => {
      if (AppState.currentState !== "background" && AppState.currentState !== "inactive") void refresh();
    }, 15000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh(true);
    });
    return () => { clearInterval(timer); subscription.remove(); request.current++; inFlight.current = false; };
  }, [refresh]);

  const changeFilters = (next: Partial<StoreOrdersFilters>) => {
    if (busy.current) return;
    request.current++;
    setFilters((current) => ({ ...current, ...next }));
    setNotice(null);
  };
  const open = (id: string) => {
    if (busy.current) return;
    request.current++;
    setSelected(null); setSelectedId(id); setDetailValid(false); setError(null); setNotice(null);
  };
  const close = () => {
    if (busy.current) return;
    request.current++;
    setSelectedId(null); setSelected(null); setDetailValid(false); setError(null); setNotice(null);
  };
  const mutate = async (action: () => Promise<StoreOrder>) => {
    // The ref also blocks a second tap before React commits the disabled state.
    if (busy.current || !detailValid || audience !== "owner") return false;
    busy.current = true;
    request.current++;
    setSaving(true); setError(null); setNotice(null);
    try {
      const updated = await action();
      if (!mounted.current) return false;
      setSelected(updated);
      setData((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) }));
      const reloaded = await refresh(false, true);
      if (mounted.current) setNotice(reloaded ? "Pedido atualizado com sucesso." : "Alteração salva. Atualize para conferir o estado atual.");
      return true;
    } catch (cause) {
      if (!mounted.current) return false;
      if (cause instanceof ApiError && cause.status === 409) {
        setDetailValid(false);
        const reloaded = await refresh(false, true);
        if (mounted.current) setError(reloaded
          ? "O pedido mudou em outro acesso. O estado foi atualizado; confira as ações disponíveis."
          : "O pedido mudou em outro acesso. Atualize o estado antes de tentar novamente.");
      } else {
        setError(errorMessage(cause));
      }
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return { filters, data, selectedId, selected, loading, saving, detailValid, error, notice, refresh, changeFilters, open, close, mutate };
}
