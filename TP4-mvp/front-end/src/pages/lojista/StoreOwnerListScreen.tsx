import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ApiError, api, formatMoney, type StoreDashboardList } from "../../services/api";

const titles: Record<StoreDashboardList, string> = {
  "active-products": "Produtos ativos", "low-stock": "Produtos com estoque baixo", promotions: "Promocoes ativas", orders: "Pedidos", messages: "Mensagens nao lidas",
};

export function StoreOwnerListScreen({ kind, status, onBack }: { kind: StoreDashboardList; status?: string; onBack: () => void }) {
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await api.storeDashboardList(kind, status)); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Nao foi possivel carregar a lista."); }
    finally { setLoading(false); }
  }, [kind, status]);
  useEffect(() => { void load(); }, [load]);

  const detail = (value: unknown) => {
    if (!value || typeof value !== "object") return String(value);
    const row = value as Record<string, unknown>;
    if (kind === "orders") return `Pedido · ${String(row.status ?? "")} · ${formatMoney(String(row.total ?? 0))}`;
    return String(row.name ?? row.title ?? row.body ?? row.id ?? "");
  };
  const subtitle = (value: unknown) => {
    if (!value || typeof value !== "object") return "";
    const row = value as Record<string, unknown>;
    if (kind === "active-products" || kind === "low-stock") return `Estoque: ${String(row.stock ?? 0)} · ${formatMoney(String(row.price ?? 0))}`;
    if (kind === "promotions") return `${String(row.discountPct ?? 0)}% de desconto${row.product && typeof row.product === "object" ? ` · ${(row.product as Record<string, unknown>).name ?? ""}` : ""}`;
    if (kind === "orders") return `${Array.isArray(row.items) ? row.items.length : 0} item(ns) · ${String(row.createdAt ?? "")}`;
    return String(row.body ?? row.createdAt ?? "");
  };
  return <ScrollView className="w-full max-w-[560px] flex-1 bg-background px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 36 }}>
    <Pressable onPress={onBack} accessibilityRole="button" className="mb-5 self-start rounded-xl bg-card px-4 py-3"><Text className="font-semibold text-primary">Voltar ao painel</Text></Pressable>
    <Text className="mb-5 text-2xl font-bold text-foreground">{titles[kind]}{status ? ` · ${status}` : ""}</Text>
    {loading ? <Text accessibilityRole="alert" className="py-10 text-center text-muted-foreground">Carregando lista...</Text> : error ? <View className="items-center gap-3 rounded-2xl bg-card p-6"><Text accessibilityRole="alert" className="text-center text-primary">{error}</Text><Pressable onPress={() => void load()} accessibilityRole="button"><Text className="font-bold text-primary">Tentar novamente</Text></Pressable></View> : items.length ? items.map((item, index) => <View key={String((item as Record<string, unknown>)?.id ?? index)} className="mb-3 rounded-2xl border border-input-border bg-card p-4"><Text className="font-semibold text-foreground">{detail(item)}</Text><Text className="mt-1 text-xs text-muted-foreground">{subtitle(item)}</Text></View>) : <Text className="py-10 text-center text-muted-foreground">Nenhum registro encontrado.</Text>}
  </ScrollView>;
}
