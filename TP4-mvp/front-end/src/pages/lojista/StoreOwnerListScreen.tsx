import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ApiError, api, formatMoney, type StoreDashboardList } from "../../services/api";
import { StorePromotionsScreen } from "./StorePromotionsScreen";

const titles: Record<StoreDashboardList, string> = {
  "active-products": "Produtos ativos", "low-stock": "Produtos com estoque baixo", promotions: "Promoções", orders: "Pedidos", messages: "Mensagens nao lidas",
};

export function StoreOwnerListScreen(props: { kind: StoreDashboardList; status?: string; onBack: () => void }) {
  if (props.kind === "promotions") return <StorePromotionsScreen onBack={props.onBack} />;
  return <GenericStoreOwnerListScreen {...props} />;
}

function GenericStoreOwnerListScreen({ kind, status, onBack }: { kind: StoreDashboardList; status?: string; onBack: () => void }) {
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingPromotion, setChangingPromotion] = useState<string | null>(null);
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
    if (kind === "promotions") return `${row.promotionalPrice ? `R$ ${String(row.promotionalPrice)}` : `${String(row.discountPercent ?? 0)}% de desconto`}${row.product && typeof row.product === "object" ? ` · ${(row.product as Record<string, unknown>).name ?? ""}` : ""}`;
    if (kind === "orders") return `${Array.isArray(row.items) ? row.items.length : 0} item(ns) · ${String(row.createdAt ?? "")}`;
    return String(row.body ?? row.createdAt ?? "");
  };
  const togglePromotion = async (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.enabled !== "boolean") return;
    setChangingPromotion(row.id); setError(null);
    try {
      await api.setStorePromotionEnabled(row.id, !row.enabled);
      setItems((old) => old.map((value) => value && typeof value === "object" && (value as Record<string, unknown>).id === row.id ? { ...(value as Record<string, unknown>), enabled: !row.enabled } : value));
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Nao foi possivel alterar a promocao."); }
    finally { setChangingPromotion(null); }
  };
  return <ScrollView className="w-full max-w-[560px] flex-1 bg-background px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 36 }}>
    <Pressable onPress={onBack} accessibilityRole="button" className="mb-5 self-start rounded-xl bg-card px-4 py-3"><Text className="font-semibold text-primary">Voltar ao painel</Text></Pressable>
    <Text className="mb-5 text-2xl font-bold text-foreground">{titles[kind]}{status ? ` · ${status}` : ""}</Text>
    {loading ? <Text accessibilityRole="alert" className="py-10 text-center text-muted-foreground">Carregando lista...</Text> : error && !items.length ? <View className="items-center gap-3 rounded-2xl bg-card p-6"><Text accessibilityRole="alert" className="text-center text-primary">{error}</Text><Pressable onPress={() => void load()} accessibilityRole="button"><Text className="font-bold text-primary">Tentar novamente</Text></Pressable></View> : items.length ? items.map((item, index) => <View key={String((item as Record<string, unknown>)?.id ?? index)} className="mb-3 rounded-2xl border border-input-border bg-card p-4"><Text className="font-semibold text-foreground">{detail(item)}</Text><Text className="mt-1 text-xs text-muted-foreground">{subtitle(item)}</Text>{kind === "promotions" && item && typeof item === "object" ? <Pressable accessibilityRole="button" disabled={changingPromotion !== null || (!(item as Record<string, unknown>).enabled && new Date(String((item as Record<string, unknown>).endAt)) <= new Date())} onPress={() => void togglePromotion(item)} className="mt-3 min-h-10 items-center justify-center rounded-full bg-primary"><Text className="font-semibold text-white">{changingPromotion === String((item as Record<string, unknown>).id) ? "Salvando..." : (item as Record<string, unknown>).enabled ? "Desativar promoção" : "Ativar promoção"}</Text></Pressable> : null}</View>) : <Text className="py-10 text-center text-muted-foreground">Nenhum registro encontrado.</Text>}
    {error && items.length > 0 ? <Text accessibilityRole="alert" className="mb-4 text-center text-primary">{error}</Text> : null}
  </ScrollView>;
}
