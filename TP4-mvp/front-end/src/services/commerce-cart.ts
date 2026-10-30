import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { PublicProduct } from "./public-catalog";

export type CartLine = { id: string; quantity: number; product: PublicProduct | null };
const queues = new Map<string, Promise<unknown>>();
export const cartStorageKey = (userId: string) => `conecta:cart:v1:user:${encodeURIComponent(userId)}`;

export function priceInCents(price: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function centsAsDecimal(cents: number | bigint) {
  const value = BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function confirmedStock(product: PublicProduct) {
  return product.inStock && Number.isSafeInteger(product.stock) && product.stock > 0 && priceInCents(product.effectivePrice) !== null ? product.stock : 0;
}
export function cartTotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + cartLineTotal(line), 0n);
}
export function cartLineTotal(line: CartLine) {
  return line.product ? BigInt(priceInCents(line.product.effectivePrice) ?? 0) * BigInt(line.quantity) : 0n;
}

function save(key: string, lines: CartLine[]) {
  const value = JSON.stringify(lines.map(({ id, quantity }) => ({ id, quantity })));
  const task = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => AsyncStorage.setItem(key, value));
  queues.set(key, task);
  void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => undefined);
  return task;
}

function parseSaved(raw: string | null): { id: string; quantity: number }[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return [...new Map(parsed.filter((entry) => entry && typeof entry.id === "string" && entry.id && Number.isSafeInteger(entry.quantity) && entry.quantity > 0)
    .map((entry) => [entry.id, { id: entry.id as string, quantity: entry.quantity as number }])).values()];
}

export function useCommerceCart(userId?: string) {
  const [snapshot, setSnapshot] = useState<{ owner?: string; lines: CartLine[]; ready: boolean }>({ owner: userId, lines: [], ready: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const owner = useRef(userId);
  owner.current = userId;
  const current = useRef(snapshot);
  current.current = snapshot;
  const locks = useRef(new Set<string>());
  const epoch = useRef(0);

  const commit = (lines: CartLine[], scope: string, version: number) => {
    if (owner.current !== scope || epoch.current !== version) return;
    const next = { owner: scope, lines, ready: true };
    current.current = next;
    setSnapshot(next);
    void save(cartStorageKey(scope), lines).catch(() => {
      if (owner.current === scope && epoch.current === version) setError("Não foi possível salvar o carrinho neste dispositivo. Tente salvar novamente.");
    });
  };

  useEffect(() => {
    const version = ++epoch.current;
    locks.current = new Set(); setBusy([]); setError(null);
    const next = { owner: userId, lines: [], ready: false };
    current.current = next; setSnapshot(next);
    if (!userId) return;
    void (async () => {
      try {
        const key = cartStorageKey(userId);
        await queues.get(key)?.catch(() => undefined);
        const saved = parseSaved(await AsyncStorage.getItem(key));
        let failed = false;
        const lines = await Promise.all(saved.map(async (line): Promise<CartLine> => {
          try {
            const product = await api.publicProduct(line.id);
            if (product.id !== line.id || !confirmedStock(product)) return { ...line, product: null };
            return { ...line, quantity: Math.min(line.quantity, product.stock), product };
          } catch { failed = true; return { ...line, product: null }; }
        }));
        if (owner.current !== userId || epoch.current !== version) return;
        if (failed) setError("Alguns produtos não puderam ser consultados. Atualize o carrinho para tentar novamente.");
        commit(lines, userId, version);
      } catch {
        if (owner.current === userId && epoch.current === version) setError("Não foi possível ler o carrinho local. Tente novamente.");
      }
    })();
    return () => { epoch.current++; };
  }, [userId, attempt]);

  const change = async (id: string, quantity: number, adding = false) => {
    if (!userId || current.current.owner !== userId || !current.current.ready || locks.current.has(id)) return;
    if (!Number.isSafeInteger(quantity) || quantity < 1) { setError("Informe uma quantidade inteira maior que zero."); return; }
    const version = epoch.current;
    const scope = userId;
    const pending = locks.current;
    pending.add(id); setBusy([...pending]); setError(null);
    try {
      const product = await api.publicProduct(id);
      if (owner.current !== scope || epoch.current !== version) return;
      if (product.id !== id) throw new Error("Não foi possível confirmar o produto selecionado.");
      const lines = current.current.lines;
      const existing = lines.find((line) => line.id === id);
      const desired = adding ? (existing?.quantity ?? 0) + quantity : quantity;
      const stock = confirmedStock(product);
      if (!Number.isSafeInteger(desired) || desired > stock) {
        if (existing) commit(lines.map((line) => line.id !== id ? line : { ...line, quantity: stock ? Math.min(line.quantity, stock) : line.quantity, product: stock ? product : null }), scope, version);
        throw new Error(stock ? `Estoque disponível: ${stock} unidades.` : "Produto indisponível ou sem estoque.");
      }
      const updated = { id, quantity: desired, product };
      commit(existing ? lines.map((line) => line.id === id ? updated : line) : [...lines, updated], scope, version);
    } catch (cause) {
      if (owner.current === scope && epoch.current === version) setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o carrinho.");
    } finally {
      pending.delete(id);
      if (owner.current === scope && epoch.current === version) setBusy([...pending]);
    }
  };
  const lines = snapshot.owner === userId ? snapshot.lines : [];
  return {
    lines, ready: snapshot.owner === userId && snapshot.ready, error, busy,
    count: lines.reduce((sum, line) => sum + line.quantity, 0), total: cartTotal(lines),
    add: (id: string) => change(id, 1, true),
    setQuantity: (id: string, quantity: number) => change(id, quantity),
    remove: (id: string) => {
      if (userId && current.current.owner === userId && current.current.ready && !locks.current.has(id)) {
        setError(null); commit(current.current.lines.filter((line) => line.id !== id), userId, epoch.current);
      }
    },
    retry: () => setAttempt((value) => value + 1),
    saveAgain: () => { if (userId && current.current.ready) { setError(null); commit(current.current.lines, userId, epoch.current); } },
  };
}
export type CommerceCart = ReturnType<typeof useCommerceCart>;
