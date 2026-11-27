import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogDomain } from "./public-catalog";

export type RecentSearch = { domain: CatalogDomain; query: string };
const queues = new Map<string, Promise<unknown>>();
const keyFor = (userId?: string) => `conecta:recent-searches:v1:${userId ? `user:${encodeURIComponent(userId)}` : "guest"}`;
const identity = (entry: RecentSearch) => `${entry.domain}:${entry.query.toLocaleLowerCase("pt-BR")}`;

async function read(key: string): Promise<RecentSearch[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((item): item is RecentSearch => item &&
      ["professionals", "stores", "products"].includes(item.domain) && typeof item.query === "string" && !!item.query.trim());
    return [...new Map(valid.map((item) => [identity(item), item])).values()].slice(0, 12);
  } catch { return []; }
}

function update(key: string, change: (entries: RecentSearch[]) => RecentSearch[]) {
  const operation = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const next = change(await read(key));
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  queues.set(key, operation);
  void operation.finally(() => { if (queues.get(key) === operation) queues.delete(key); }).catch(() => undefined);
  return operation;
}

export const recentSearches = {
  async load(userId?: string) {
    const key = keyFor(userId);
    await queues.get(key)?.catch(() => undefined);
    return read(key);
  },
  record: (userId: string | undefined, entry: RecentSearch) => update(keyFor(userId), (entries) => {
    const query = entry.query.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!query) return entries;
    const next = { ...entry, query };
    return [next, ...entries.filter((item) => identity(item) !== identity(next))].slice(0, 12);
  }),
  remove: (userId: string | undefined, entry: RecentSearch) => update(keyFor(userId), (entries) => entries.filter((item) => identity(item) !== identity(entry))),
  clear: (userId?: string) => update(keyFor(userId), () => []),
};

export function useRecentSearches(userId?: string) {
  const [snapshot, setSnapshot] = useState<{ owner: string | undefined; entries: RecentSearch[] }>({ owner: userId, entries: [] });
  const [error, setError] = useState<string | null>(null);
  const scope = useRef(userId);
  scope.current = userId;
  const revision = useRef(0);
  useEffect(() => {
    let current = true;
    const version = ++revision.current;
    setSnapshot({ owner: userId, entries: [] });
    setError(null);
    recentSearches.load(userId).then((items) => {
      if (current && revision.current === version) setSnapshot({ owner: userId, entries: items });
    }).catch(() => { if (current) setError("Não foi possível ler o histórico local."); });
    return () => { current = false; };
  }, [userId]);

  const perform = useCallback(async (operation: Promise<RecentSearch[]>) => {
    const version = ++revision.current;
    const owner = userId;
    try {
      const items = await operation;
      if (scope.current === owner && revision.current === version) { setSnapshot({ owner, entries: items }); setError(null); }
    } catch {
      if (scope.current === owner && revision.current === version) setError("Não foi possível salvar o histórico local. Tente novamente.");
    }
  }, [userId]);
  const record = useCallback((domain: CatalogDomain, query: string) => {
    if (query.trim()) void perform(recentSearches.record(userId, { domain, query }));
  }, [userId, perform]);
  return { entries: snapshot.owner === userId ? snapshot.entries : [], error, record,
    remove: (entry: RecentSearch) => { void perform(recentSearches.remove(userId, entry)); },
    clear: () => { void perform(recentSearches.clear(userId)); },
  };
}
