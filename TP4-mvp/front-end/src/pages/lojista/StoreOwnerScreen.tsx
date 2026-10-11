import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { StoreOwnerTabBar } from "../../components/lojista/StoreOwnerTabBar";
import { ApiError, api, formatMoney, type StoreDashboardList, type StoreDashboardSummary, type StoreIdentity } from "../../services/api";

const logo = require("../../../assets/logotipo.png");
const orderStatuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELED"] as const;
const statusLabels: Record<(typeof orderStatuses)[number], string> = {
  PENDING: "Pendentes", CONFIRMED: "Confirmados", PREPARING: "Em preparo", READY: "Prontos", COMPLETED: "Concluídos", CANCELED: "Cancelados",
};
type IconName = React.ComponentProps<typeof Ionicons>["name"];

function DashboardCard({ title, detail, icon, badge, accessibilityLabel, onPress }: {
  title: string; detail: string; icon: IconName; badge?: number; accessibilityLabel: string; onPress: () => void;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} className="min-h-[148px] flex-1 justify-between rounded-[18px] bg-card p-4 shadow-sm shadow-primary/10">
    <View className="flex-row items-start justify-between">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#fbe7e8]"><Ionicons name={icon} size={22} color="#b94b50" /></View>
      {badge ? <View className="min-w-[22px] items-center rounded-full bg-primary px-1.5 py-0.5"><Text className="text-xs font-semibold text-white">{badge}</Text></View> : null}
    </View>
    <View><Text className="text-lg font-semibold text-foreground">{title}</Text><Text className="mt-0.5 text-sm text-muted-foreground">{detail}</Text></View>
  </Pressable>;
}

export function StoreOwnerScreen({ onOpenList, onOpenOrders, onOpenProducts, onStoreMissing, onSwitchProfile, onOpenProfile, onSignOut, onEditStore, userName, avatarUrl }: {
  onEditStore?: () => void;
  onOpenList: (kind: StoreDashboardList) => void;
  onOpenOrders: (status: string) => void;
  onOpenProducts: () => void;
  onStoreMissing: () => void;
  onSwitchProfile: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  userName?: string;
  avatarUrl?: string | null;
}) {
  const [summary, setSummary] = useState<StoreDashboardSummary | null>(null);
  const [store, setStore] = useState<StoreIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onStoreMissingRef = useRef(onStoreMissing);
  onStoreMissingRef.current = onStoreMissing;
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [identity, result] = await Promise.all([
        api.storeIdentity().catch(() => null),
        api.storeDashboard(),
      ]);
      if (!result.hasStore) { onStoreMissingRef.current(); return; }
      setStore(identity);
      setSummary(result);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o painel.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const storeName = store?.name?.trim() || "sua loja";
  const firstName = userName?.trim().split(/\s+/)[0];
  const storeStatus = store?.status === "ACTIVE" ? "Loja ativa" : store?.status === "DRAFT" ? "Cadastro em rascunho" : store?.status === "INACTIVE" ? "Loja inativa" : "Painel da loja";
  const pendingOrders = summary?.ordersByStatus.PENDING ?? 0;

  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between bg-card px-5 py-3">
        <Pressable onPress={onSwitchProfile} accessibilityRole="button" accessibilityLabel="Trocar perfil" className="h-10 w-10 items-center justify-center rounded-full bg-background"><Ionicons name="arrow-back" size={20} color="#141c25" /></Pressable>
        <Image source={logo} className="h-9 w-[145px]" resizeMode="contain" accessibilityLabel="Conecta Obras Itacoatiara" />
        <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="Abrir informações do perfil" className="h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-[#fbe7e8]">
          {avatarUrl ? <Image source={{ uri: avatarUrl }} className="h-9 w-9 rounded-full" /> : <Ionicons name="person-outline" size={21} color="#99333a" />}
        </Pressable>
      </View>

      <View className="px-5 pt-5">
        <View className="mb-2 flex-row items-center gap-2"><View className={`h-2.5 w-2.5 rounded-full ${store?.status === "ACTIVE" ? "bg-[#3d7a5a]" : "bg-[#b98542]"}`} /><Text className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{storeStatus}</Text></View>
        <Text className="text-[26px] font-semibold text-foreground">{firstName ? `Olá, ${firstName}!` : "Olá!"}</Text>
        <Text className="mb-6 mt-1 text-sm leading-5 text-muted-foreground">{storeName === "sua loja" ? "Acompanhe sua loja em um só lugar." : `${storeName} está pronta para você acompanhar.`}</Text>

        <View className="mb-6 rounded-[18px] bg-card p-4 shadow-sm shadow-primary/10">
          <View className="flex-row items-center gap-2"><Ionicons name="storefront" size={20} color="#b94b50" /><Text numberOfLines={1} className="min-w-0 flex-1 text-lg font-semibold text-foreground">Vitrine {storeName}</Text></View>
          <Text className="mt-1 text-sm leading-5 text-muted-foreground">Atualize informações, horários e aparência da sua vitrine.</Text>
          {onEditStore ? <Pressable onPress={onEditStore} accessibilityRole="button" accessibilityLabel="Editar loja" className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary"><Ionicons name="create-outline" size={20} color="#ffffff" /><Text className="text-sm font-semibold text-white">Editar Loja</Text></Pressable> : null}
        </View>

        {loading ? <Text accessibilityRole="alert" className="py-12 text-center text-muted-foreground">Carregando indicadores...</Text> : error ? <View className="items-center gap-3 rounded-2xl bg-card p-6"><Text accessibilityRole="alert" className="text-center text-primary">{error}</Text><Pressable onPress={() => void load()} accessibilityRole="button" className="rounded-xl bg-primary px-5 py-3"><Text className="font-bold text-white">Tentar novamente</Text></Pressable></View> : summary ? <>
          <View className="mb-6 gap-4">
            <View className="flex-row gap-4">
              <DashboardCard title="Produtos" detail={`${summary.activeProducts} ativos`} icon="cube-outline" accessibilityLabel={`Produtos ativos: ${summary.activeProducts}`} onPress={onOpenProducts} />
              <DashboardCard title="Promoções" detail={`${summary.activePromotions} ativas`} icon="pricetag-outline" accessibilityLabel={`Promoções ativas: ${summary.activePromotions}`} onPress={() => onOpenList("promotions")} />
            </View>
            <View className="flex-row gap-4">
              <DashboardCard title="Mensagens" detail={`${summary.unreadMessages} não lidas`} icon="chatbubble-ellipses-outline" badge={summary.unreadMessages} accessibilityLabel={`Mensagens não lidas: ${summary.unreadMessages}`} onPress={() => onOpenList("messages")} />
              <DashboardCard title="Pedidos" detail={`${pendingOrders} aguardando confirmação`} icon="bag-handle-outline" badge={pendingOrders} accessibilityLabel={`Pedidos pendentes: ${pendingOrders}`} onPress={() => onOpenList("orders")} />
            </View>
          </View>

          {summary.lowStockProducts > 0 ? <Pressable onPress={() => onOpenList("low-stock")} accessibilityRole="button" accessibilityLabel={`Estoque baixo: ${summary.lowStockProducts}`} className="mb-6 flex-row items-center gap-3 rounded-[18px] bg-card p-4"><View className="h-10 w-10 items-center justify-center rounded-full bg-[#fbe7e8]"><Ionicons name="alert-circle-outline" size={21} color="#b94b50" /></View><View className="flex-1"><Text className="font-semibold text-foreground">Estoque baixo</Text><Text className="text-sm text-muted-foreground">{summary.lowStockProducts} {summary.lowStockProducts === 1 ? "produto precisa" : "produtos precisam"} de atenção</Text></View><Ionicons name="chevron-forward" size={18} color="#897171" /></Pressable> : null}

          <View className="mb-2 flex-row items-center justify-between"><Text className="text-lg font-semibold text-foreground">Pedidos por status</Text><Text className="text-xs text-muted-foreground">Visão geral</Text></View>
          <View className="rounded-[18px] bg-card px-4 py-1 shadow-sm shadow-primary/10">
            {orderStatuses.map((status, index) => <Pressable key={status} onPress={() => onOpenOrders(status)} accessibilityRole="button" accessibilityLabel={`${statusLabels[status]}: ${summary.ordersByStatus[status] ?? 0}`} className={`min-h-12 flex-row items-center justify-between ${index < orderStatuses.length - 1 ? "border-b border-input-border" : ""}`}><Text className="text-sm text-foreground">{statusLabels[status]}</Text><View className="flex-row items-center gap-2"><Text className="font-semibold text-primary">{summary.ordersByStatus[status] ?? 0}</Text><Ionicons name="chevron-forward" size={16} color="#897171" /></View></Pressable>)}
          </View>
          <View className="mb-2 mt-6 flex-row items-center justify-between"><Text className="text-lg font-semibold text-foreground">Última atividade</Text><Text className="text-xs text-muted-foreground">Pedidos</Text></View>
          {summary.latestOrder ? <Pressable onPress={() => onOpenOrders(summary.latestOrder!.status)} accessibilityRole="button" accessibilityLabel="Ver último pedido" className="flex-row items-center gap-3 rounded-[18px] bg-card p-4 shadow-sm shadow-primary/10">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#e7eefc]"><Ionicons name="car-outline" size={21} color="#b94b50" /></View>
            <View className="min-w-0 flex-1"><Text numberOfLines={1} className="font-semibold text-foreground">Pedido #{summary.latestOrder.id.slice(-6).toUpperCase()}</Text><Text numberOfLines={1} className="text-xs text-muted-foreground">{summary.latestOrder.itemName || "Pedido da loja"} · {formatMoney(summary.latestOrder.total)}</Text></View>
            <Text className="text-xs font-semibold text-primary">{statusLabels[summary.latestOrder.status as keyof typeof statusLabels] ?? summary.latestOrder.status}</Text>
          </Pressable> : <View className="rounded-[18px] bg-card p-4"><Text className="text-sm text-muted-foreground">Os pedidos recentes aparecerão aqui.</Text></View>}
        </> : null}
        <Pressable onPress={onSignOut} accessibilityRole="button" accessibilityLabel="Sair da conta" className="mt-6 self-center flex-row items-center gap-2 py-2"><Ionicons name="log-out-outline" size={18} color="#897171" /><Text className="text-sm text-muted-foreground">Sair da conta</Text></Pressable>
      </View>
    </ScrollView>
    <StoreOwnerTabBar selected="Painel" onDashboard={() => {}} onOrders={() => onOpenList("orders")} onProducts={onOpenProducts} onPromotions={() => onOpenList("promotions")} onSettings={() => onEditStore?.()} />
  </View>;
}
