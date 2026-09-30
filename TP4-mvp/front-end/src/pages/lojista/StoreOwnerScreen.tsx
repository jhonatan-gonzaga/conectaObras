import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ApiError, api, type StoreDashboardSummary } from "../../services/api";

const orderStatuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELED"] as const;
const statusLabels: Record<(typeof orderStatuses)[number], string> = {
  PENDING: "Pendentes", CONFIRMED: "Confirmados", PREPARING: "Em preparo", READY: "Prontos", COMPLETED: "Concluidos", CANCELED: "Cancelados",
};

function DashboardCard({ label, value, icon, onPress }: { label: string; value: number; icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} className="min-h-28 flex-1 justify-between rounded-2xl border border-input-border bg-card p-4"><Ionicons name={icon} size={22} color="#b94b50" /><Text className="text-2xl font-bold text-foreground">{value}</Text><Text className="text-sm text-muted-foreground">{label}</Text></Pressable>;
}

export function StoreOwnerScreen({ onOpenList, onOpenOrders, onStoreMissing, onSignOut }: { onOpenList: (kind: "active-products" | "low-stock" | "promotions" | "orders" | "messages") => void; onOpenOrders: (status: string) => void; onStoreMissing: () => void; onSignOut: () => void }) {
  const [summary, setSummary] = useState<StoreDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onStoreMissingRef = useRef(onStoreMissing);
  onStoreMissingRef.current = onStoreMissing;
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.storeDashboard();
      if (!result.hasStore) { onStoreMissingRef.current(); return; }
      setSummary(result);
    }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Nao foi possivel carregar o painel."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <ScrollView className="w-full max-w-[560px] flex-1 bg-background px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}>
    <View className="mb-6 flex-row items-center justify-between"><View><Text className="text-2xl font-bold text-foreground">Painel da loja</Text><Text className="mt-1 text-sm text-muted-foreground">Resumo atualizado pela sua loja</Text></View><Pressable onPress={onSignOut} accessibilityRole="button" accessibilityLabel="Sair da conta" className="rounded-full bg-card p-3"><Ionicons name="log-out-outline" size={22} color="#b94b50" /></Pressable></View>
    {loading ? <Text accessibilityRole="alert" className="py-12 text-center text-muted-foreground">Carregando indicadores...</Text> : error ? <View className="items-center gap-3 rounded-2xl bg-card p-6"><Text accessibilityRole="alert" className="text-center text-primary">{error}</Text><Pressable onPress={() => void load()} accessibilityRole="button" className="rounded-xl bg-primary px-5 py-3"><Text className="font-bold text-white">Tentar novamente</Text></Pressable></View> : summary ? <>
      <View className="flex-row gap-3"><DashboardCard label="Produtos ativos" value={summary.activeProducts} icon="cube-outline" onPress={() => onOpenList("active-products")} /><DashboardCard label="Estoque baixo" value={summary.lowStockProducts} icon="alert-circle-outline" onPress={() => onOpenList("low-stock")} /></View>
      <View className="mt-3 flex-row gap-3"><DashboardCard label="Promocoes ativas" value={summary.activePromotions} icon="pricetag-outline" onPress={() => onOpenList("promotions")} /><DashboardCard label="Mensagens nao lidas" value={summary.unreadMessages} icon="chatbubble-ellipses-outline" onPress={() => onOpenList("messages")} /></View>
      <Text className="mb-3 mt-7 text-lg font-bold text-foreground">Pedidos por status</Text>
      <View className="flex-row flex-wrap gap-3">{orderStatuses.map((status) => <View key={status} className="w-[47%]"><DashboardCard label={statusLabels[status]} value={summary.ordersByStatus[status] ?? 0} icon="receipt-outline" onPress={() => onOpenOrders(status)} /></View>)}</View>
    </> : null}
  </ScrollView>;
}
